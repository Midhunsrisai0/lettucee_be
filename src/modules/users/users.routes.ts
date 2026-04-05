import { Hono } from "hono";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  listApprovedUsers,
  loginUser,
  registerUser,
  whoAmI,
  approveUser,
} from "./users.controller";

const usersRoutes = new Hono();

usersRoutes.post("/register", registerUser);
usersRoutes.post("/login", loginUser);
usersRoutes.get("/whoami", authMiddleware, whoAmI);
usersRoutes.get("/", listApprovedUsers);
usersRoutes.patch("/:userId/approve", authMiddleware, approveUser);

export { usersRoutes };
