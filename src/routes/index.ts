import { Hono } from "hono";
import { healthRoutes } from "../modules/health/health.routes";
import { usersRoutes } from "../modules/users/users.routes";

const apiRoutes = new Hono();

apiRoutes.route("/health", healthRoutes);
apiRoutes.route("/api/v1/users", usersRoutes);

export { apiRoutes };
