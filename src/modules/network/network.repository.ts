import type { Context } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppBindings, ApprovalQueueJob } from "../../types/env";
import { getDrizzleDb } from "../../lib/drizzle";
import { chitti, pandu, users } from "../../db/schema";
import type { CreateEdgeInput, ListEdgesInput } from "./network.schema";

export const networkRepository = {
  async createEdge(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    input: CreateEdgeInput,
  ) {
    try {
      const db = getDrizzleDb(c as any);
      const result = await db
        .insert(chitti)
        .values({
          source: input.source,
          edge: input.edge,
          destination: input.destination || null,
        })
        .returning();

      return result[0];
    } catch (error: any) {
      console.error(
        `[network.createEdge] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async listEdges(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    filters: ListEdgesInput,
  ) {
    try {
      const db = getDrizzleDb(c as any);
      const conditions: any[] = [];

      if (filters.sourceId) {
        conditions.push(eq(chitti.source, filters.sourceId));
      }

      if (filters.destinationId) {
        conditions.push(eq(chitti.destination, filters.destinationId));
      }

      if (filters.edgeType) {
        conditions.push(eq(chitti.edge, filters.edgeType));
      }

      const query =
        conditions.length > 0
          ? db
              .select()
              .from(chitti)
              .where(and(...conditions))
          : db.select().from(chitti);

      return await query;
    } catch (error: any) {
      console.error(
        `[network.listEdges] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async getEdge(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    edgeId: string,
  ) {
    try {
      const db = getDrizzleDb(c as any);
      const result = await db
        .select()
        .from(chitti)
        .where(eq(chitti.id, edgeId));

      return result[0] || null;
    } catch (error: any) {
      console.error(
        `[network.getEdge] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async deleteEdge(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    edgeId: string,
  ) {
    try {
      const db = getDrizzleDb(c as any);
      const result = await db
        .delete(chitti)
        .where(eq(chitti.id, edgeId))
        .returning();

      return result[0];
    } catch (error: any) {
      console.error(
        `[network.deleteEdge] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async getOutgoingEdges(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    sourceId: string,
  ) {
    try {
      const db = getDrizzleDb(c as any);
      return await db.select().from(chitti).where(eq(chitti.source, sourceId));
    } catch (error: any) {
      console.error(
        `[network.getOutgoingEdges] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async getIncomingEdges(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    destinationId: string,
  ) {
    try {
      const db = getDrizzleDb(c as any);
      return await db
        .select()
        .from(chitti)
        .where(eq(chitti.destination, destinationId));
    } catch (error: any) {
      console.error(
        `[network.getIncomingEdges] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async getExistingEdgePhoneNumbers(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    sourceId: string,
  ) {
    try {
      const db = getDrizzleDb(c as any);
      const edges = await db
        .select({ edge: chitti.edge })
        .from(chitti)
        .where(eq(chitti.source, sourceId));

      return edges.map((e) => e.edge);
    } catch (error: any) {
      console.error(
        `[network.getExistingEdgePhoneNumbers] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async bulkInsertEdges(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    edges: Array<{ source: string; edge: string; destination: string | null }>,
  ) {
    try {
      const db = getDrizzleDb(c as any);
      if (edges.length === 0) {
        return [];
      }

      const result = await db.insert(chitti).values(edges).returning();
      return result;
    } catch (error: any) {
      console.error(
        `[network.bulkInsertEdges] repository error ${JSON.stringify({ error: String(error), count: edges.length })}`,
      );
      throw error;
    }
  },

  async updateUserAdjacencyList(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    userId: string,
    newUserIds: string[],
    nowIso: string,
  ) {
    try {
      const db = getDrizzleDb(c as any);

      // Fetch existing pandu record
      const panduRecord = await db
        .select()
        .from(pandu)
        .where(eq(pandu.userId, userId))
        .limit(1);

      let adjacencyList: string[] = [];
      if (panduRecord[0]) {
        try {
          adjacencyList = JSON.parse(panduRecord[0].adjacencyList);
        } catch (parseErr) {
          console.warn(
            `[network.updateUserAdjacencyList] failed to parse adjacency list ${JSON.stringify({ userId, error: String(parseErr) })}`,
          );
          adjacencyList = [];
        }
      }

      // Add new user IDs that aren't already in the list
      for (const newUserId of newUserIds) {
        if (!adjacencyList.includes(newUserId)) {
          adjacencyList.push(newUserId);
        }
      }

      // Update or insert pandu record
      await db
        .insert(pandu)
        .values({
          userId,
          adjacencyList: JSON.stringify(adjacencyList),
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .onConflictDoUpdate({
          target: pandu.userId,
          set: {
            adjacencyList: JSON.stringify(adjacencyList),
            updatedAt: nowIso,
          },
        });

      return adjacencyList;
    } catch (error: any) {
      console.error(
        `[network.updateUserAdjacencyList] repository error ${JSON.stringify({ error: String(error), userId })}`,
      );
      throw error;
    }
  },

  async processApprovalQueueJob(
    c: Context<{ Bindings: AppBindings }>,
    job: ApprovalQueueJob,
  ) {
    const db = getDrizzleDb(c);
    const { tupleId, approveeUserId } = job;
    const nowIso = new Date().toISOString();

    console.log(
      `[approval-queue] processing job ${JSON.stringify({ tupleId, approveeUserId })}`,
    );

    try {
      const tuple = await db
        .select()
        .from(chitti)
        .where(eq(chitti.id, tupleId))
        .limit(1);

      if (!tuple[0]) {
        console.warn(
          `[approval-queue] tuple not found ${JSON.stringify({ tupleId })}`,
        );
        return;
      }

      const sourceUserId = tuple[0].source;

      await db
        .update(chitti)
        .set({
          destination: approveeUserId,
          updatedAt: nowIso,
        })
        .where(eq(chitti.id, tupleId));

      console.log(
        `[approval-queue] tuple destination updated ${JSON.stringify({ tupleId, destination: approveeUserId })}`,
      );

      const sourceUserPandu = await db
        .select()
        .from(pandu)
        .where(eq(pandu.userId, sourceUserId))
        .limit(1);

      if (!sourceUserPandu[0]) {
        console.warn(
          `[approval-queue] source user pandu not found ${JSON.stringify({ sourceUserId })}`,
        );
        return;
      }

      let adjacencyList: string[] = [];
      try {
        adjacencyList = JSON.parse(sourceUserPandu[0].adjacencyList);
      } catch (parseErr) {
        console.warn(
          `[approval-queue] failed to parse adjacency list ${JSON.stringify({ sourceUserId, error: String(parseErr) })}`,
        );
        adjacencyList = [];
      }

      if (!adjacencyList.includes(approveeUserId)) {
        adjacencyList.push(approveeUserId);

        await db
          .update(pandu)
          .set({
            adjacencyList: JSON.stringify(adjacencyList),
            updatedAt: nowIso,
          })
          .where(eq(pandu.userId, sourceUserId));

        console.log(
          `[approval-queue] adjacency list updated ${JSON.stringify({ sourceUserId, approveeUserId, newCount: adjacencyList.length })}`,
        );
      } else {
        console.log(
          `[approval-queue] approvee already in adjacency list ${JSON.stringify({ sourceUserId, approveeUserId })}`,
        );
      }
    } catch (error) {
      console.error(
        `[approval-queue] failed to process job ${JSON.stringify({ tupleId, approveeUserId, error: String(error) })}`,
      );
      throw error;
    }
  },

  async syncContacts(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    userId: string,
    phoneNumbers: string[],
  ) {
    try {
      const db = getDrizzleDb(c as any);
      const nowIso = new Date().toISOString();

      // Step 1: Get existing phone numbers for this user
      const existingEdges = await db
        .select({ edge: chitti.edge })
        .from(chitti)
        .where(eq(chitti.source, userId));

      const existingPhones = new Set(existingEdges.map((e) => e.edge));

      // Step 2: Filter to only new phone numbers
      const newPhones = phoneNumbers.filter(
        (phone) => !existingPhones.has(phone),
      );

      if (newPhones.length === 0) {
        return { synced: 0, resolved: 0 };
      }

      // Step 3: Map phone numbers to user IDs
      const resolvedUserIds: string[] = [];
      const edgesToInsert: Array<{
        source: string;
        edge: string;
        destination: string | null;
      }> = [];

      for (const phone of newPhones) {
        // Find user with this phone number
        const targetUser = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phoneNumber, phone))
          .limit(1);

        const destinationUserId = targetUser[0]?.id || null;

        edgesToInsert.push({
          source: userId,
          edge: phone,
          destination: destinationUserId,
        });

        if (destinationUserId) {
          resolvedUserIds.push(destinationUserId);
        }
      }

      // Step 4: Bulk insert edges
      if (edgesToInsert.length > 0) {
        await this.bulkInsertEdges(c, edgesToInsert);
      }

      // Step 5: Update pandu adjacency list with resolved user IDs
      if (resolvedUserIds.length > 0) {
        await this.updateUserAdjacencyList(c, userId, resolvedUserIds, nowIso);
      }

      return {
        synced: edgesToInsert.length,
        resolved: resolvedUserIds.length,
      };
    } catch (error: any) {
      console.error(
        `[network.syncContacts] repository error ${JSON.stringify({ error: String(error), userId })}`,
      );
      throw error;
    }
  },
};
