import type { Context } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppBindings } from "../../types/env";
import { getDrizzleDb } from "../../lib/drizzle";
import { chitti } from "../../db/schema";
import type { CreateEdgeInput, ListEdgesInput } from "./network.schema";

export const networkRepository = {
  async createEdge(
    c: Context<{ Bindings: AppBindings }>,
    input: CreateEdgeInput,
  ) {
    const db = getDrizzleDb(c);
    const result = await db
      .insert(chitti)
      .values({
        source: input.source,
        edge: input.edge,
        destination: input.destination || null,
      })
      .returning();

    return result[0];
  },

  async listEdges(
    c: Context<{ Bindings: AppBindings }>,
    filters: ListEdgesInput,
  ) {
    const db = getDrizzleDb(c);
    const conditions = [];

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
  },

  async getEdge(c: Context<{ Bindings: AppBindings }>, edgeId: string) {
    const db = getDrizzleDb(c);
    const result = await db.select().from(chitti).where(eq(chitti.id, edgeId));

    return result[0] || null;
  },

  async deleteEdge(c: Context<{ Bindings: AppBindings }>, edgeId: string) {
    const db = getDrizzleDb(c);
    const result = await db
      .delete(chitti)
      .where(eq(chitti.id, edgeId))
      .returning();

    return result[0];
  },

  async getOutgoingEdges(
    c: Context<{ Bindings: AppBindings }>,
    sourceId: string,
  ) {
    const db = getDrizzleDb(c);
    return await db.select().from(chitti).where(eq(chitti.source, sourceId));
  },

  async getIncomingEdges(
    c: Context<{ Bindings: AppBindings }>,
    destinationId: string,
  ) {
    const db = getDrizzleDb(c);
    return await db
      .select()
      .from(chitti)
      .where(eq(chitti.destination, destinationId));
  },
};
