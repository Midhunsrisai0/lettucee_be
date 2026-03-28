import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppBindings } from "../../types/env";
import { sha256Hex } from "../../utils/crypto";
import { USER_STATUS } from "../../db/schema";
import { usersRepository } from "./users.repository";
import { registerUserSchema } from "./users.schema";

export const registerUser = async (c: Context<{ Bindings: AppBindings }>) => {
  const body = await c.req.json();
  const parsed = registerUserSchema.safeParse(body);

  if (!parsed.success) {
    throw new HTTPException(400, {
      message: "Invalid registration payload",
      cause: parsed.error.flatten(),
    });
  }

  const { email, password, fullName } = parsed.data;
  const existingUser = await usersRepository.findByEmail(c, email);

  if (existingUser) {
    throw new HTTPException(409, { message: "Email already registered" });
  }

  const nowIso = new Date().toISOString();
  const id = crypto.randomUUID();
  const passwordHash = await sha256Hex(password);

  await usersRepository.createPending(c, {
    id,
    email,
    passwordHash,
    fullName,
    nowIso,
  });

  return c.json(
    {
      id,
      email,
      fullName,
      status: USER_STATUS.PENDING,
      message: "Registration submitted. Awaiting admin approval.",
    },
    201,
  );
};

export const listApprovedUsers = async (
  c: Context<{ Bindings: AppBindings }>,
) => {
  const users = await usersRepository.listApproved(c);
  return c.json({ data: users }, 200);
};
