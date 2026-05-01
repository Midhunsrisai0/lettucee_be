import { Hono } from "hono";
import { healthCheck, healthQueueProducer } from "./health.controller";

const healthRoutes = new Hono();

healthRoutes.get("/", healthCheck);
healthRoutes.get("/queue", healthQueueProducer);

export { healthRoutes };
