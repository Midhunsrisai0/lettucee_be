import { Hono } from "hono";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { bulkSync, canCall, getMutuals, syncContact } from "./nexus.controller";

const nexusRoutes = new Hono();

// All nexus routes require auth.
nexusRoutes.use("*", authMiddleware);

nexusRoutes.post("/bulk-sync", bulkSync);
nexusRoutes.post("/sync", syncContact);
nexusRoutes.get("/mutuals", getMutuals);
nexusRoutes.get("/can-call/:userId", canCall);

export { nexusRoutes };
