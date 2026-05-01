import { Hono } from "hono";
import { healthRoutes } from "../modules/health/health.routes";
import { usersRoutes } from "../modules/users/users.routes";
import networkRoutes from "../modules/network/network.routes";
import { authMiddleware } from "../middlewares/auth.middleware";

const apiRoutes = new Hono();

apiRoutes.route("/health", healthRoutes);
apiRoutes.route("/api/v1/users", usersRoutes);
apiRoutes.use("/api/v1/network/*", authMiddleware);
apiRoutes.route("/api/v1/network", networkRoutes);

export { apiRoutes };
