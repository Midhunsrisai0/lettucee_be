import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppBindings } from "../../types/env";
import type { AuthRequestUser } from "../../middlewares/auth.middleware";
import { sha256Hex } from "../../utils/crypto";
import { nexusRepository } from "./nexus.repository";
import { bulkSyncSchema, singleSyncSchema } from "./nexus.schema";

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getCallerHash(
  c: Context<{ Bindings: AppBindings }>,
): Promise<string> {
  const reqWithUser = c.req as typeof c.req & Partial<AuthRequestUser>;
  const userId = reqWithUser.userId;
  if (!userId) throw new HTTPException(401, { message: "Unauthorized" });

  const phoneHash = await nexusRepository.getPhoneHashByUserId(c, userId);
  if (!phoneHash) {
    throw new HTTPException(500, {
      message: "Account has no phone hash — re-register to fix",
    });
  }
  return phoneHash;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /contacts/bulk-sync
 * Called once on registration. Client sends raw phone numbers from device contacts.
 * Server normalizes and hashes them. Returns the caller's mutual contact list.
 */
export const bulkSync = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[nexus.bulkSync] request received", {
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const callerHash = await getCallerHash(c);
    const body = await c.req.json();
    const parsed = bulkSyncSchema.safeParse(body);

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: "Invalid payload",
        cause: parsed.error.flatten(),
      });
    }

    // Normalize and hash phone numbers server-side
    const hashes: string[] = [];
    for (const phoneNumber of parsed.data.phoneNumbers) {
      const normalized = phoneNumber.replace(/\D/g, "");
      const hash = await sha256Hex(normalized);
      hashes.push(hash);
    }

    const mutuals = await nexusRepository.bulkSync(
      c,
      callerHash,
      hashes,
    );

    console.log("[nexus.bulkSync] success", {
      incomingCount: parsed.data.phoneNumbers.length,
      mutualsFound: mutuals.length,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: "Bulk sync complete",
        data: { mutuals },
      },
      200,
    );
  } catch (error) {
    console.error("[nexus.bulkSync] failed", {
      durationMs: Date.now() - startMs,
      error,
    });
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: "Bulk sync failed" });
  }
};

/**
 * POST /contacts/sync
 * Called when a new contact is added on-device.
 * Client sends raw phone number. Server normalizes and hashes it.
 * Returns whether the contact is registered and whether they're a mutual.
 */
export const syncContact = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[nexus.syncContact] request received", {
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const callerHash = await getCallerHash(c);
    const body = await c.req.json();
    const parsed = singleSyncSchema.safeParse(body);

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: "Invalid payload",
        cause: parsed.error.flatten(),
      });
    }

    // Normalize and hash phone number server-side
    const normalized = parsed.data.phoneNumber.replace(/\D/g, "");
    const hash = await sha256Hex(normalized);

    const result = await nexusRepository.syncOneContact(
      c,
      callerHash,
      hash,
    );

    console.log("[nexus.syncContact] success", {
      registered: result.registered,
      isMutual: result.isMutual,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: result.isMutual
          ? "New mutual contact!"
          : result.registered
            ? "Contact registered but not mutual yet"
            : "Contact not yet registered — queued",
        data: result,
      },
      200,
    );
  } catch (error) {
    console.error("[nexus.syncContact] failed", {
      durationMs: Date.now() - startMs,
      error,
    });
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: "Contact sync failed" });
  }
};

/**
 * GET /contacts/mutuals
 * Returns the full list of mutual contacts for the authenticated user.
 */
export const getMutuals = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[nexus.getMutuals] request received", {
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const callerHash = await getCallerHash(c);
    const mutuals = await nexusRepository.getMutuals(c, callerHash);

    console.log("[nexus.getMutuals] success", {
      count: mutuals.length,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: "Mutuals fetched successfully",
        data: { mutuals },
      },
      200,
    );
  } catch (error) {
    console.error("[nexus.getMutuals] failed", {
      durationMs: Date.now() - startMs,
      error,
    });
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: "Failed to fetch mutuals" });
  }
};

/**
 * GET /contacts/can-call/:userId
 * O(1) lookup: checks if the caller has a mutual bond with the target user.
 * Returns { allowed: bool }.
 */
export const canCall = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[nexus.canCall] request received", {
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const callerHash = await getCallerHash(c);
    const targetUserId = c.req.param("userId");

    if (!targetUserId) {
      throw new HTTPException(400, { message: "userId param is required" });
    }

    const targetHash = await nexusRepository.getPhoneHashByUserId(
      c,
      targetUserId,
    );

    if (!targetHash) {
      throw new HTTPException(404, { message: "Target user not found" });
    }

    const allowed = await nexusRepository.canCallByHash(
      c,
      callerHash,
      targetHash,
    );

    console.log("[nexus.canCall] success", {
      allowed,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: allowed ? "Call allowed" : "Call not allowed",
        data: { allowed },
      },
      200,
    );
  } catch (error) {
    console.error("[nexus.canCall] failed", {
      durationMs: Date.now() - startMs,
      error,
    });
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(500, { message: "Can-call check failed" });
  }
};
