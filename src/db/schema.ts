import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  status: text("status", { enum: userStatusValues })
    .notNull()
    .default(USER_STATUS.PENDING),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  rejectedReason: text("rejected_reason"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  lastLoginAt: text("last_login_at"),
});

export type User = typeof users.$inferSelect;

export type PublicUser = Pick<
  User,
  "id" | "email" | "fullName" | "status" | "createdAt"
>;
