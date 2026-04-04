import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
});

export type User = typeof users.$inferSelect;

export type PublicUser = Pick<
  User,
  "id" | "email" | "username" | "status" | "createdAt" | "hasSuperAccess"
>;
