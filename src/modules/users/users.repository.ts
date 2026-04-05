import type { Context } from "hono";
import { desc, eq, or } from "drizzle-orm";
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

  async findByPhoneNumber(
    c: Context<{ Bindings: AppBindings }>,
    phoneNumber: string,
  ): Promise<User | null> {
    const db = getDrizzleDb(c);
    const result = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, phoneNumber))
      .limit(1);

    return result[0] ?? null;
  },

  async findByEmailOrPhone(
    c: Context<{ Bindings: AppBindings }>,
    input: {
      email?: string;
      phoneNumber?: string;
    },
  ): Promise<User | null> {
    const db = getDrizzleDb(c);

    if (input.email && input.phoneNumber) {
      const result = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.email, input.email.toLowerCase()),
            eq(users.phoneNumber, input.phoneNumber),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    }

    if (input.email) {
      return this.findByEmail(c, input.email);
    }

    if (input.phoneNumber) {
      return this.findByPhoneNumber(c, input.phoneNumber);
    }

    return null;
  },

  async createPending(
    c: Context<{ Bindings: AppBindings }>,
    input: {
      email: string;
      countryCode: string;
      phoneNumber: string;
      username: string;
      passwordHash: string;
      phoneHash: string;
      nowIso: string;
    },
  ): Promise<void> {
    const db = getDrizzleDb(c);
    await db.insert(users).values({
      email: input.email.toLowerCase(),
      countryCode: input.countryCode,
      phoneNumber: input.phoneNumber,
      username: input.username,
      passwordHash: input.passwordHash,
      phoneHash: input.phoneHash,
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
        username: users.username,
        status: users.status,
        createdAt: users.createdAt,
        hasSuperAccess: users.hasSuperAccess,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.status, USER_STATUS.APPROVED))
      .orderBy(desc(users.createdAt));

    return rows;
  },

  async touchLastLoginAt(
    c: Context<{ Bindings: AppBindings }>,
    userId: string,
    nowIso: string,
  ): Promise<void> {
    const db = getDrizzleDb(c);
    await db
      .update(users)
      .set({
        lastLoginAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(users.id, userId));
  },

  async findById(
    c: Context<{ Bindings: AppBindings }>,
    userId: string,
  ): Promise<User | null> {
    const db = getDrizzleDb(c);
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return result[0] ?? null;
  },

  async approveById(
    c: Context<{ Bindings: AppBindings }>,
    userId: string,
    nowIso: string,
  ): Promise<void> {
    const db = getDrizzleDb(c);
    await db
      .update(users)
      .set({
        status: USER_STATUS.APPROVED,
        updatedAt: nowIso,
      })
      .where(eq(users.id, userId));
  },
};

