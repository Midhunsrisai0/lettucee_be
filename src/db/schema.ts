import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const USER_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
} as const;

export const userStatusValues = [
  USER_STATUS.PENDING,
  USER_STATUS.APPROVED,
  USER_STATUS.REJECTED,
  USER_STATUS.SUSPENDED,
] as const;

export type UserStatus = (typeof userStatusValues)[number];

const createCuid = () => {
  // CUID-like value for local id generation without an extra package.
  const timePart = Date.now().toString(36);
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `c${timePart}${randomPart}`;
};

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createCuid()),
  email: text("email").notNull().unique(),
  countryCode: text("country_code").notNull(),
  phoneNumber: text("phone_number").notNull().unique(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  status: text("status", { enum: userStatusValues })
    .notNull()
    .default(USER_STATUS.PENDING),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  hasSuperAccess: integer("has_super_access", { mode: "boolean" })
    .notNull()
    .default(false),
  isAdmin: integer("is_admin", { mode: "boolean" })
    .notNull()
    .default(false),
  // SHA-256 of normalized phone number (digits only). Set on registration.
  phoneHash: text("phone_hash").unique(),
});

export type User = typeof users.$inferSelect;

export type PublicUser = Pick<
  User,
  "id" | "email" | "username" | "status" | "createdAt" | "hasSuperAccess" | "isAdmin"
>;

// ─── Contact Graph ────────────────────────────────────────────────────────────

/**
 * contactGraph — directed edges; from_hash → to_hash.
 * Both values are SHA-256 phone hashes, never raw numbers.
 */
export const contactGraph = sqliteTable(
  "contacts",
  {
    fromHash: text("from_hash").notNull(),
    toHash: text("to_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.fromHash, t.toHash] }),
    index("idx_contacts_from").on(t.fromHash),
    index("idx_contacts_to").on(t.toHash),
  ],
);

/**
 * soulBonds — bidirectional mutual connections.
 * Always stored canonical: user_a < user_b (avoids duplicate pairs).
 */
export const soulBonds = sqliteTable(
  "mutuals",
  {
    userA: text("user_a").notNull(),
    userB: text("user_b").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userA, t.userB] }),
    index("idx_mutuals_a").on(t.userA),
    index("idx_mutuals_b").on(t.userB),
  ],
);

/**
 * ghostQueue — edges where to_hash is not yet registered.
 * Resolved when the target user signs up.
 */
export const ghostQueue = sqliteTable(
  "pending_contacts",
  {
    fromHash: text("from_hash").notNull(),
    toHash: text("to_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.fromHash, t.toHash] }),
    index("idx_pending_to").on(t.toHash),
  ],
);

export type ContactEdge = typeof contactGraph.$inferSelect;
export type SoulBond = typeof soulBonds.$inferSelect;
export type GhostEntry = typeof ghostQueue.$inferSelect;
