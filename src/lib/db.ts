import type { Context } from "hono";
import type { AppBindings } from "../types/env";

export const getDb = (c: Context<{ Bindings: AppBindings }>) => c.env.DB;
