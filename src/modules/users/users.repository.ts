import type { Context } from "hono";
import { desc, eq } from "drizzle-orm";
import type { AppBindings } from "../../types/env";
import { getDrizzleDb } from "../../lib/drizzle";
import {
  USER_STATUS,
  users,
  type PublicUser,
  type User,
} from "../../db/schema";

export const usersRepository = {
  async findByEmail(
    c: Context<{ Bindings: AppBindings }>,
    email: string,
  ): Promise<User | null> {
    const db = getDrizzleDb(c);
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return result[0] ?? null;
  },

  async createPending(
    c: Context<{ Bindings: AppBindings }>,
    input: {
      id: string;
      email: string;
      passwordHash: string;
      fullName: string;
      nowIso: string;
    },
  ): Promise<void> {
    const db = getDrizzleDb(c);
    await db.insert(users).values({
      id: input.id,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      status: USER_STATUS.PENDING,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    });
  },

  async listApproved(
    c: Context<{ Bindings: AppBindings }>,
  ): Promise<PublicUser[]> {
    const db = getDrizzleDb(c);
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.status, USER_STATUS.APPROVED))
      .orderBy(desc(users.createdAt));

    return rows;
  },
};
