import { Hono } from "hono";
import { healthCheck } from "./health.controller";

const healthRoutes = new Hono();

healthRoutes.get("/", healthCheck);

export { healthRoutes };
