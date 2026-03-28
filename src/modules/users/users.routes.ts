import { Hono } from "hono";
import { listApprovedUsers, registerUser } from "./users.controller";

const usersRoutes = new Hono();

usersRoutes.post("/register", registerUser);
usersRoutes.get("/", listApprovedUsers);

export { usersRoutes };
