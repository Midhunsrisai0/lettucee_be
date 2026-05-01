import type { Context } from "hono";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { AppBindings } from "../../types/env";
import { getDrizzleDb } from "../../lib/drizzle";
import { queueApprovalJob } from "../../queues/adjacency-queue";
import {
  approvals,
  chitti,
  pandu,
  USER_STATUS,
  userConfig,
  users,
  type PublicUser,
  type User,
} from "../../db/schema";

type UserWithConfig = User & {
  hasSuperAccess: boolean;
  isAdmin: boolean;
};

export class PendingApprovalConflictError extends Error {
  constructor() {
    super("User is no longer in pending status");
    this.name = "PendingApprovalConflictError";
  }
}

export const usersRepository = {
  async findById(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    userId: string,
  ): Promise<User | null> {
    try {
      const db = getDrizzleDb(c as any);
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return result[0] ?? null;
    } catch (error: any) {
      console.error(
        `[users.findById] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async isAdmin(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    userId: string,
  ): Promise<boolean> {
    try {
      const db = getDrizzleDb(c as any);
      const result = await db
        .select({
          isAdmin: sql<boolean>`coalesce(${userConfig.isAdmin}, false)`,
        })
        .from(userConfig)
        .where(eq(userConfig.userId, userId))
        .limit(1);

      return (result[0]?.isAdmin as unknown as boolean) ?? false;
    } catch (error: any) {
      console.error(
        `[users.isAdmin] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async approvePendingUser(
    c: Context<{ Bindings: AppBindings }>,
    input: {
      approveeUserId: string;
      approverUserId: string;
      superAccess: boolean;
      superAccessReason?: string;
      comments?: string;
      nowIso: string;
    },
  ): Promise<
    { success: true } | { success: false; error: string; conflict?: boolean }
  > {
    const db = getDrizzleDb(c);

    try {
      // Step 1: Atomically set status from PENDING -> APPROVED
      await db
        .update(users)
        .set({
          status: USER_STATUS.APPROVED,
          updatedAt: input.nowIso,
        })
        .where(
          and(
            eq(users.id, input.approveeUserId),
            eq(users.status, USER_STATUS.PENDING),
          ),
        );

      const changesResult = await (c.env as AppBindings).DB.prepare(
        "select changes() as changes",
      ).first<{ changes: number }>();

      if (!changesResult || Number(changesResult.changes ?? 0) !== 1) {
        return {
          success: false,
          error: "User not in pending status",
          conflict: true,
        };
      }

      // Step 2: Fetch approved user to obtain mobile number
      const approvedUser = await db
        .select()
        .from(users)
        .where(eq(users.id, input.approveeUserId))
        .limit(1);

      if (!approvedUser[0]) {
        return { success: false, error: "Approved user not found" };
      }

      const approvedUserMobileNumber = approvedUser[0].phoneNumber;

      // Step 3: Insert approval record
      await db.insert(approvals).values({
        approvee: input.approveeUserId,
        approver: input.approverUserId,
        superAccessGiven: input.superAccess,
        superAccessReason: input.superAccessReason,
        comments: input.comments,
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      });

      // Step 4: Upsert userConfig
      await db
        .insert(userConfig)
        .values({
          userId: input.approveeUserId,
          isAdmin: false,
          hasSuperAccess: input.superAccess,
        })
        .onConflictDoUpdate({
          target: userConfig.userId,
          set: { hasSuperAccess: input.superAccess },
        });

      // Step 5: Ensure pandu exists for user
      await db
        .insert(pandu)
        .values({
          userId: input.approveeUserId,
          adjacencyList: JSON.stringify([]),
          createdAt: input.nowIso,
          updatedAt: input.nowIso,
        })
        .onConflictDoNothing();

      // Step 6: Find pending chitti tuples that reference the approved user's mobile
      const pendingTuples = await db
        .select()
        .from(chitti)
        .where(
          and(
            eq(chitti.edge, approvedUserMobileNumber),
            isNull(chitti.destination),
          ),
        );

      console.log(
        `[users.approvePending] found pending tuples ${JSON.stringify({ approveeUserId: input.approveeUserId, mobileNumber: approvedUserMobileNumber, count: pendingTuples.length })}`,
      );

      // Step 7: Queue approval jobs for each pending tuple
      if (pendingTuples.length > 0) {
        for (const tuple of pendingTuples) {
          await queueApprovalJob(c, tuple.id, input.approveeUserId);
        }

        console.log(
          `[users.approvePending] queued approval jobs ${JSON.stringify({ approveeUserId: input.approveeUserId, tupleCount: pendingTuples.length })}`,
        );
      }

      return { success: true };
    } catch (error: any) {
      console.error(
        `[users.approvePending] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      return { success: false, error: String(error) };
    }
  },

  async findByEmail(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    email: string,
  ): Promise<UserWithConfig | null> {
    const db = getDrizzleDb(c as any);
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        countryCode: users.countryCode,
        phoneNumber: users.phoneNumber,
        username: users.username,
        passwordHash: users.passwordHash,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        hasSuperAccess: sql<boolean>`coalesce(${userConfig.hasSuperAccess}, false)`,
        isAdmin: sql<boolean>`coalesce(${userConfig.isAdmin}, false)`,
      })
      .from(users)
      .leftJoin(userConfig, eq(userConfig.userId, users.id))
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return result[0] ?? null;
  },

  async findByPhoneNumber(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    phoneNumber: string,
  ): Promise<UserWithConfig | null> {
    try {
      const db = getDrizzleDb(c as any);
      const result = await db
        .select({
          id: users.id,
          email: users.email,
          countryCode: users.countryCode,
          phoneNumber: users.phoneNumber,
          username: users.username,
          passwordHash: users.passwordHash,
          status: users.status,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          hasSuperAccess: sql<boolean>`coalesce(${userConfig.hasSuperAccess}, false)`,
          isAdmin: sql<boolean>`coalesce(${userConfig.isAdmin}, false)`,
        })
        .from(users)
        .leftJoin(userConfig, eq(userConfig.userId, users.id))
        .where(eq(users.phoneNumber, phoneNumber))
        .limit(1);

      return result[0] ?? null;
    } catch (error: any) {
      console.error(
        `[users.findByPhoneNumber] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async findByEmailOrPhone(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    input: {
      email?: string;
      phoneNumber?: string;
    },
  ): Promise<UserWithConfig | null> {
    const db = getDrizzleDb(c as any);

    if (input.email && input.phoneNumber) {
      const result = await db
        .select({
          id: users.id,
          email: users.email,
          countryCode: users.countryCode,
          phoneNumber: users.phoneNumber,
          username: users.username,
          passwordHash: users.passwordHash,
          status: users.status,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          hasSuperAccess: sql<boolean>`coalesce(${userConfig.hasSuperAccess}, false)`,
          isAdmin: sql<boolean>`coalesce(${userConfig.isAdmin}, false)`,
        })
        .from(users)
        .leftJoin(userConfig, eq(userConfig.userId, users.id))
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
      return this.findByEmail(c as any, input.email);
    }

    if (input.phoneNumber) {
      return this.findByPhoneNumber(c as any, input.phoneNumber);
    }

    return null;
  },

  async createPending(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    input: {
      email: string;
      countryCode: string;
      phoneNumber: string;
      username: string;
      passwordHash: string;
      nowIso: string;
    },
  ): Promise<void> {
    try {
      const db = getDrizzleDb(c as any);

      await db.insert(users).values({
        email: input.email.toLowerCase(),
        countryCode: input.countryCode,
        phoneNumber: input.phoneNumber,
        username: input.username,
        passwordHash: input.passwordHash,
        status: USER_STATUS.PENDING,
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      });
    } catch (error: any) {
      console.error(
        `[users.createPending] repository error ${JSON.stringify({ error: String(error) })}`,
      );
      throw error;
    }
  },

  async listApproved(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
  ): Promise<PublicUser[]> {
    const db = getDrizzleDb(c as any);
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        status: users.status,
        createdAt: users.createdAt,
        hasSuperAccess: sql<boolean>`coalesce(${userConfig.hasSuperAccess}, false)`,
      })
      .from(users)
      .leftJoin(userConfig, eq(userConfig.userId, users.id))
      .where(eq(users.status, USER_STATUS.APPROVED))
      .orderBy(desc(users.createdAt));

    return rows as unknown as PublicUser[];
  },

  async listPending(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
  ): Promise<
    {
      id: string;
      email: string;
      countryCode: string;
      phoneNumber: string;
      username: string;
      status: User["status"];
      createdAt: string;
    }[]
  > {
    const db = getDrizzleDb(c as any);
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        countryCode: users.countryCode,
        phoneNumber: users.phoneNumber,
        username: users.username,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.status, USER_STATUS.PENDING))
      .orderBy(desc(users.createdAt));

    return rows;
  },

  async touchLastLoginAt(
    c: Context<{ Bindings: AppBindings }> | { env: AppBindings },
    userId: string,
    nowIso: string,
  ): Promise<void> {
    const db = getDrizzleDb(c as any);
    await db
      .update(users)
      .set({ lastLoginAt: nowIso, updatedAt: nowIso })
      .where(eq(users.id, userId));
  },
};
