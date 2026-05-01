import type { Context } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppBindings } from "../../types/env";
import { getDrizzleDb } from "../../lib/drizzle";
import { chitti } from "../../db/schema";
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
};
