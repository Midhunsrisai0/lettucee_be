import type { Context } from "hono";
import { and, eq, inArray, or } from "drizzle-orm";
import type { AppBindings } from "../../types/env";
import { getDrizzleDb } from "../../lib/drizzle";
import { contactGraph, ghostQueue, soulBonds, users } from "../../db/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Canonical ordering: always store/lookup as (smaller, larger) to avoid duplicates. */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// ─── Repository ───────────────────────────────────────────────────────────────

export const nexusRepository = {
  // ── Users (read-only helpers) ─────────────────────────────────────────────

  /** Find users whose phone_hash matches any of the given hashes (batch). */
  async findUsersByPhoneHashes(
    c: Context<{ Bindings: AppBindings }>,
    hashes: string[],
  ): Promise<{ id: string; username: string; phoneHash: string | null }[]> {
    if (hashes.length === 0) return [];
    const db = getDrizzleDb(c);
    return db
      .select({ id: users.id, username: users.username, phoneHash: users.phoneHash })
      .from(users)
      .where(inArray(users.phoneHash, hashes));
  },

  /** Get a single user's phone_hash by their user ID. */
  async getPhoneHashByUserId(
    c: Context<{ Bindings: AppBindings }>,
    userId: string,
  ): Promise<string | null> {
    const db = getDrizzleDb(c);
    const result = await db
      .select({ phoneHash: users.phoneHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return result[0]?.phoneHash ?? null;
  },

  /** Get a user's public info by their phone_hash. */
  async getUserByPhoneHash(
    c: Context<{ Bindings: AppBindings }>,
    phoneHash: string,
  ): Promise<{ id: string; username: string } | null> {
    const db = getDrizzleDb(c);
    const result = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.phoneHash, phoneHash))
      .limit(1);
    return result[0] ?? null;
  },

  // ── contactGraph ──────────────────────────────────────────────────────────

  /** Insert a directed contact edge. No-op if it already exists. */
  async upsertContactEdge(
    c: Context<{ Bindings: AppBindings }>,
    fromHash: string,
    toHash: string,
  ): Promise<void> {
    const db = getDrizzleDb(c);
    await db
      .insert(contactGraph)
      .values({ fromHash, toHash, createdAt: Date.now() })
      .onConflictDoNothing();
  },

  /** True if the directed edge from → to exists. */
  async contactEdgeExists(
    c: Context<{ Bindings: AppBindings }>,
    fromHash: string,
    toHash: string,
  ): Promise<boolean> {
    const db = getDrizzleDb(c);
    const result = await db
      .select({ fromHash: contactGraph.fromHash })
      .from(contactGraph)
      .where(
        and(
          eq(contactGraph.fromHash, fromHash),
          eq(contactGraph.toHash, toHash),
        ),
      )
      .limit(1);
    return result.length > 0;
  },

  // ── soulBonds ────────────────────────────────────────────────────────────

  /** Insert a mutual bond (canonical order: userA < userB). No-op if exists. */
  async upsertSoulBond(
    c: Context<{ Bindings: AppBindings }>,
    hashA: string,
    hashB: string,
  ): Promise<void> {
    const db = getDrizzleDb(c);
    const [userA, userB] = canonicalPair(hashA, hashB);
    await db
      .insert(soulBonds)
      .values({ userA, userB, createdAt: Date.now() })
      .onConflictDoNothing();
  },

  /** True if a mutual bond exists between hashA and hashB. */
  async soulBondExists(
    c: Context<{ Bindings: AppBindings }>,
    hashA: string,
    hashB: string,
  ): Promise<boolean> {
    const db = getDrizzleDb(c);
    const [userA, userB] = canonicalPair(hashA, hashB);
    const result = await db
      .select({ userA: soulBonds.userA })
      .from(soulBonds)
      .where(and(eq(soulBonds.userA, userA), eq(soulBonds.userB, userB)))
      .limit(1);
    return result.length > 0;
  },

  /** All mutual contacts for a user — returns public user info. */
  async getMutuals(
    c: Context<{ Bindings: AppBindings }>,
    callerHash: string,
  ): Promise<{ id: string; username: string }[]> {
    const db = getDrizzleDb(c);

    // Get all mutual bond rows where caller appears on either side.
    const bonds = await db
      .select()
      .from(soulBonds)
      .where(
        or(eq(soulBonds.userA, callerHash), eq(soulBonds.userB, callerHash)),
      );

    if (bonds.length === 0) return [];

    // Resolve the "other" hash for each bond.
    const otherHashes = bonds.map((b) =>
      b.userA === callerHash ? b.userB : b.userA,
    );

    // Batch-fetch user info for the other side.
    return db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.phoneHash, otherHashes));
  },

  // ── ghostQueue ────────────────────────────────────────────────────────────

  /** Queue an unresolved contact (target not yet registered). */
  async upsertGhostEntry(
    c: Context<{ Bindings: AppBindings }>,
    fromHash: string,
    toHash: string,
  ): Promise<void> {
    const db = getDrizzleDb(c);
    await db
      .insert(ghostQueue)
      .values({ fromHash, toHash, createdAt: Date.now() })
      .onConflictDoNothing();
  },

  /** All ghost entries waiting for a specific hash to register. */
  async getGhostsAwaitingHash(
    c: Context<{ Bindings: AppBindings }>,
    toHash: string,
  ) {
    const db = getDrizzleDb(c);
    return db
      .select()
      .from(ghostQueue)
      .where(eq(ghostQueue.toHash, toHash));
  },

  /** Remove a resolved ghost entry. */
  async deleteGhostEntry(
    c: Context<{ Bindings: AppBindings }>,
    fromHash: string,
    toHash: string,
  ): Promise<void> {
    const db = getDrizzleDb(c);
    await db
      .delete(ghostQueue)
      .where(
        and(
          eq(ghostQueue.fromHash, fromHash),
          eq(ghostQueue.toHash, toHash),
        ),
      );
  },

  // ── Composite operations ──────────────────────────────────────────────────

  /**
   * Bulk sync: called once on registration.
   * 1. Finds registered contacts from incoming hashes.
   * 2. Creates directed edges + checks for mutual bonds.
   * 3. Queues unregistered hashes in ghostQueue.
   * 4. Resolves any ghost entries that were waiting for the caller.
   * Returns the caller's full mutual list.
   */
  async bulkSync(
    c: Context<{ Bindings: AppBindings }>,
    callerHash: string,
    incomingHashes: string[],
  ): Promise<{ id: string; username: string }[]> {
    // 1. Resolve registered contacts from the incoming batch.
    const registered = await this.findUsersByPhoneHashes(c, incomingHashes);
    const registeredSet = new Set(registered.map((u) => u.phoneHash ?? ""));

    // 2. For each registered contact: edge + mutual check.
    for (const contact of registered) {
      if (!contact.phoneHash) continue;
      await this.upsertContactEdge(c, callerHash, contact.phoneHash);
      const hasReverse = await this.contactEdgeExists(
        c,
        contact.phoneHash,
        callerHash,
      );
      if (hasReverse) {
        await this.upsertSoulBond(c, callerHash, contact.phoneHash);
      }
    }

    // 3. Queue unregistered hashes as ghost entries.
    for (const hash of incomingHashes) {
      if (!registeredSet.has(hash)) {
        await this.upsertGhostEntry(c, callerHash, hash);
      }
    }

    // 4. Resolve ghost entries pointing at this caller.
    await this.resolveGhostQueue(c, callerHash);

    return this.getMutuals(c, callerHash);
  },

  /**
   * Resolves the ghostQueue for a newly registered user.
   * Called after every new registration.
   * For each ghost entry (fromHash → callerHash):
   *   - Confirm the contact edge
   *   - Check if caller also has fromHash in their contacts
   *   - If mutual → create soulBond
   *   - Delete the ghost entry
   */
  async resolveGhostQueue(
    c: Context<{ Bindings: AppBindings }>,
    callerHash: string,
  ): Promise<void> {
    const ghosts = await this.getGhostsAwaitingHash(c, callerHash);
    for (const ghost of ghosts) {
      await this.upsertContactEdge(c, ghost.fromHash, callerHash);
      const callerHasThem = await this.contactEdgeExists(
        c,
        callerHash,
        ghost.fromHash,
      );
      if (callerHasThem) {
        await this.upsertSoulBond(c, callerHash, ghost.fromHash);
      }
      await this.deleteGhostEntry(c, ghost.fromHash, callerHash);
    }
  },

  /**
   * Single contact sync: called when a new contact is detected on-device.
   * - If not registered → ghost entry saved, returns { registered: false }
   * - If registered → edge created, mutual checked, returns full result
   */
  async syncOneContact(
    c: Context<{ Bindings: AppBindings }>,
    callerHash: string,
    contactHash: string,
  ): Promise<{
    registered: boolean;
    isMutual: boolean;
    user?: { id: string; username: string };
  }> {
    const contactUser = await this.getUserByPhoneHash(c, contactHash);

    if (!contactUser) {
      await this.upsertGhostEntry(c, callerHash, contactHash);
      return { registered: false, isMutual: false };
    }

    await this.upsertContactEdge(c, callerHash, contactHash);
    const hasReverse = await this.contactEdgeExists(c, contactHash, callerHash);

    if (hasReverse) {
      await this.upsertSoulBond(c, callerHash, contactHash);
      return { registered: true, isMutual: true, user: contactUser };
    }

    return { registered: true, isMutual: false };
  },

  /**
   * O(1) lookup: can these two users call each other?
   * Requires both phone hashes.
   */
  async canCallByHash(
    c: Context<{ Bindings: AppBindings }>,
    callerHash: string,
    targetHash: string,
  ): Promise<boolean> {
    return this.soulBondExists(c, callerHash, targetHash);
  },
};
