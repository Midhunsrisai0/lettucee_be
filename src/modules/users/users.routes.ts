import { Hono } from "hono";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  approvePendingUser,
  listApprovedUsers,
  loginUser,
  registerUser,
  whoAmI,
} from "./users.controller";

const usersRoutes = new Hono();

usersRoutes.post("/register", registerUser);
usersRoutes.post("/login", loginUser);
usersRoutes.get("/whoami", authMiddleware, whoAmI);
usersRoutes.post("/approve-pending", authMiddleware, approvePendingUser);
usersRoutes.get("/", listApprovedUsers);

export { usersRoutes };
