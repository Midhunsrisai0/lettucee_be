import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
});

export const userConfig = sqliteTable("userconfig", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createCuid()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  hasSuperAccess: integer("has_super_access", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const approvals = sqliteTable("approvals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createCuid()),
  approvee: text("approvee")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  approver: text("approver")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  superAccessGiven: integer("super_access_given", {
    mode: "boolean",
  }).notNull(),
  superAccessReason: text("super_access_reason"),
  comments: text("comments"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const chitti = sqliteTable(
  "chitti",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createCuid()),
    source: text("source")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    edge: text("edge").notNull(),
    destination: text("destination").references(() => users.id, {
      onDelete: "cascade",
    }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("chitti_source_idx").on(table.source),
    index("chitti_destination_idx").on(table.destination),
  ],
);

export const pandu = sqliteTable("pandu", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createCuid()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  adjacencyList: text("adjacency_list").notNull(), // JSON string of { edge: destinationUserId }
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type User = typeof users.$inferSelect;

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  status: UserStatus;
  createdAt: string;
  hasSuperAccess: boolean;
};
