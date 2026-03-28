import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import type { AppBindings } from "../types/env";

export const getDrizzleDb = (c: Context<{ Bindings: AppBindings }>) =>
  drizzle(c.env.DB);
