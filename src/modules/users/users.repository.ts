import type { Context } from "hono";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { AppBindings } from "../../types/env";
import { getDrizzleDb } from "../../lib/drizzle";
import { queueApprovalJob } from "../../lib/adjacency-queue";
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

  async isAdmin(
    c: Context<{ Bindings: AppBindings }>,
    userId: string,
  ): Promise<boolean> {
    const db = getDrizzleDb(c);
    const result = await db
      .select({
        isAdmin: userConfig.isAdmin,
      })
      .from(userConfig)
      .where(eq(userConfig.userId, userId))
      .limit(1);

    return result[0]?.isAdmin ?? false;
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
  ): Promise<void> {
    const db = getDrizzleDb(c);

    // Step 1: Update user status to approved
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

    const changesResult = await c.env.DB.prepare(
      "select changes() as changes",
    ).first<{ changes: number }>();

    if (!changesResult || Number(changesResult.changes ?? 0) !== 1) {
      throw new PendingApprovalConflictError();
    }

    // Step 2: Fetch approved user to get mobile number
    const approvedUser = await db
      .select()
      .from(users)
      .where(eq(users.id, input.approveeUserId))
      .limit(1);

    if (!approvedUser[0]) {
      throw new Error("Approved user not found");
    }

    const approvedUserMobileNumber = approvedUser[0].phoneNumber;

    // Step 3: Create approval record
    await db.insert(approvals).values({
      approvee: input.approveeUserId,
      approver: input.approverUserId,
      superAccessGiven: input.superAccess,
      superAccessReason: input.superAccessReason,
      comments: input.comments,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    });

    // Step 4: Create userConfig
    await db
      .insert(userConfig)
      .values({
        userId: input.approveeUserId,
        isAdmin: false,
        hasSuperAccess: input.superAccess,
      })
      .onConflictDoUpdate({
        target: userConfig.userId,
        set: {
          hasSuperAccess: input.superAccess,
        },
      });

    // Step 5: Create pandu record with empty adjacency list
    await db
      .insert(pandu)
      .values({
        userId: input.approveeUserId,
        adjacencyList: JSON.stringify([]),
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      })
      .onConflictDoNothing();

    // Step 6: Find pending tuples where edge matches approved user's mobile and destination is null
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

    // Step 7: Queue each tuple for approval processing
    if (pendingTuples.length > 0) {
      for (const tuple of pendingTuples) {
        await queueApprovalJob(c, tuple.id, input.approveeUserId);
      }

      console.log(
        `[users.approvePending] queued approval jobs ${JSON.stringify({ approveeUserId: input.approveeUserId, tupleCount: pendingTuples.length })}`,
      );
    }
  },

  async findByEmail(
    c: Context<{ Bindings: AppBindings }>,
    email: string,
  ): Promise<UserWithConfig | null> {
    const db = getDrizzleDb(c);
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
    c: Context<{ Bindings: AppBindings }>,
    phoneNumber: string,
  ): Promise<UserWithConfig | null> {
    const db = getDrizzleDb(c);
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
  },

  async findByEmailOrPhone(
    c: Context<{ Bindings: AppBindings }>,
    input: {
      email?: string;
      phoneNumber?: string;
    },
  ): Promise<UserWithConfig | null> {
    const db = getDrizzleDb(c);

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
        hasSuperAccess: sql<boolean>`coalesce(${userConfig.hasSuperAccess}, false)`,
      })
      .from(users)
      .leftJoin(userConfig, eq(userConfig.userId, users.id))
      .where(eq(users.status, USER_STATUS.APPROVED))
      .orderBy(desc(users.createdAt));

    return rows;
  },

  async listPending(c: Context<{ Bindings: AppBindings }>): Promise<
    Array<{
      id: string;
      email: string;
      countryCode: string;
      phoneNumber: string;
      username: string;
      status: User["status"];
      createdAt: string;
    }>
  > {
    const db = getDrizzleDb(c);
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
};
