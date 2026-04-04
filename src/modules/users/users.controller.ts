import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign } from "hono/jwt";
import type { AppBindings } from "../../types/env";
import type { AuthRequestUser } from "../../middlewares/auth.middleware";
import { sha256Hex } from "../../utils/crypto";
import { USER_STATUS } from "../../db/schema";
import { usersRepository } from "./users.repository";
import { loginUserSchema, registerUserSchema } from "./users.schema";

export const registerUser = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[users.register] request received", {
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const body = await c.req.json();
    const parsed = registerUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: "Invalid registration payload",
        cause: parsed.error.flatten(),
      });
    }

    const { email, countryCode, phoneNumber, username, password } = parsed.data;
    const existingUser = await usersRepository.findByEmail(c, email);

    if (existingUser) {
      throw new HTTPException(409, { message: "Email already registered" });
    }

    const existingPhoneUser = await usersRepository.findByPhoneNumber(
      c,
      phoneNumber,
    );

    if (existingPhoneUser) {
      throw new HTTPException(409, {
        message: "Phone number already registered",
      });
    }

    const nowIso = new Date().toISOString();
    const passwordHash = await sha256Hex(password);

    await usersRepository.createPending(c, {
      email,
      countryCode,
      phoneNumber,
      username,
      passwordHash,
      nowIso,
    });

    console.log("[users.register] success", {
      email,
      phoneNumber,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 201,
        message: "Registration submitted. Awaiting admin approval.",
        data: {
          email,
          countryCode,
          phoneNumber,
          username,
          status: USER_STATUS.PENDING,
        },
      },
      201,
    );
  } catch (error) {
    console.error("[users.register] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to register user",
    });
  }
};

export const listApprovedUsers = async (
  c: Context<{ Bindings: AppBindings }>,
) => {
  const startMs = Date.now();
  console.log("[users.listApproved] request received", {
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const users = await usersRepository.listApproved(c);

    console.log("[users.listApproved] success", {
      count: users.length,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: "Approved users fetched successfully",
        data: users,
      },
      200,
    );
  } catch (error) {
    console.error("[users.listApproved] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to list approved users",
    });
  }
};

export const loginUser = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[users.login] request received", {
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const body = await c.req.json();
    const parsed = loginUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: "Invalid login payload",
        cause: parsed.error.flatten(),
      });
    }

    const { email, phoneNumber, password } = parsed.data;
    const user = await usersRepository.findByEmailOrPhone(c, {
      email,
      phoneNumber,
    });

    if (!user) {
      throw new HTTPException(401, { message: "Invalid credentials" });
    }

    const passwordHash = await sha256Hex(password);
    if (user.passwordHash !== passwordHash) {
      throw new HTTPException(401, { message: "Invalid credentials" });
    }

    if (user.status === USER_STATUS.PENDING) {
      return c.json(
        {
          code: 201,
          message: "User is pending approval",
          data: {
            status: user.status,
          },
        },
        201,
      );
    }

    if (user.status === USER_STATUS.REJECTED) {
      return c.json(
        {
          code: 411,
          message: "User account was rejected",
          data: {
            status: user.status,
          },
        },
        411,
      );
    }

    if (user.status === USER_STATUS.SUSPENDED) {
      return c.json(
        {
          code: 505,
          message: "User account is suspended",
          data: {
            status: user.status,
          },
        },
        505,
      );
    }

    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new HTTPException(500, { message: "JWT secret is not configured" });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const token = await sign(
      {
        sub: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        username: user.username,
        status: user.status,
        iat: nowSec,
        exp: nowSec + 60 * 60 * 24,
      },
      jwtSecret,
    );

    const nowIso = new Date().toISOString();
    await usersRepository.touchLastLoginAt(c, user.id, nowIso);

    console.log("[users.login] success", {
      userId: user.id,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: "Login successful",
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            username: user.username,
            status: user.status,
            hasSuperAccess: user.hasSuperAccess,
          },
        },
      },
      200,
    );
  } catch (error) {
    console.error("[users.login] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to login user",
    });
  }
};

export const whoAmI = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[users.whoami] request received", {
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });

  try {
    const reqWithUser = c.req as typeof c.req & Partial<AuthRequestUser>;
    const { userId, email, username, phoneNumber } = reqWithUser;

    if (!userId || !email || !username || !phoneNumber) {
      throw new HTTPException(401, { message: "Invalid token payload" });
    }

    console.log("[users.whoami] success", {
      userId,
      durationMs: Date.now() - startMs,
    });

    return c.json(
      {
        code: 200,
        message: "User profile fetched successfully",
        data: {
          userId,
          email,
          username,
          phoneNumber,
        },
      },
      200,
    );
  } catch (error) {
    console.error("[users.whoami] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to fetch user profile",
    });
  }
};
