import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign } from "hono/jwt";
import type { AppBindings } from "../../types/env";
import type { AuthRequestUser } from "../../middlewares/auth.middleware";
import { sha256Hex } from "../../utils/crypto";
import { USER_STATUS } from "../../db/schema";
import {
  PendingApprovalConflictError,
  usersRepository,
} from "./users.repository";
import {
  approvePendingUserSchema,
  loginUserSchema,
  registerUserSchema,
} from "./users.schema";

export const registerUser = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log(
    `[users.register] request received ${JSON.stringify({ method: c.req.method, path: c.req.path, timestamp: new Date().toISOString() })}`,
  );

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

    console.log(
      `[users.register] success ${JSON.stringify({ email, phoneNumber, durationMs: Date.now() - startMs })}`,
    );

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
    console.error(
      `[users.register] failed ${JSON.stringify({ durationMs: Date.now() - startMs, error: String(error) })}`,
    );

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
  console.log(
    `[users.listApproved] request received ${JSON.stringify({ method: c.req.method, path: c.req.path, timestamp: new Date().toISOString() })}`,
  );

  try {
    const users = await usersRepository.listApproved(c);

    console.log(
      `[users.listApproved] success ${JSON.stringify({ count: users.length, durationMs: Date.now() - startMs })}`,
    );

    return c.json(
      {
        code: 200,
        message: "Approved users fetched successfully",
        data: users,
      },
      200,
    );
  } catch (error) {
    console.error(
      `[users.listApproved] failed ${JSON.stringify({ durationMs: Date.now() - startMs, error: String(error) })}`,
    );

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to list approved users",
    });
  }
};

export const listPendingUsers = async (
  c: Context<{ Bindings: AppBindings }>,
) => {
  const startMs = Date.now();
  console.log(
    `[users.listPending] request received ${JSON.stringify({ method: c.req.method, path: c.req.path, timestamp: new Date().toISOString() })}`,
  );

  try {
    const reqWithUser = c.req as typeof c.req & Partial<AuthRequestUser>;
    const requesterUserId = reqWithUser.userId;

    if (!requesterUserId) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const callerIsAdmin = await usersRepository.isAdmin(c, requesterUserId);
    if (!callerIsAdmin) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const users = await usersRepository.listPending(c);

    console.log(
      `[users.listPending] success ${JSON.stringify({ count: users.length, requesterUserId, durationMs: Date.now() - startMs })}`,
    );

    return c.json(
      {
        code: 200,
        message: "Pending users fetched successfully",
        data: users,
      },
      200,
    );
  } catch (error) {
    console.error(
      `[users.listPending] failed ${JSON.stringify({ durationMs: Date.now() - startMs, error: String(error) })}`,
    );

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to list pending users",
    });
  }
};

export const loginUser = async (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log(
    `[users.login] request received ${JSON.stringify({ method: c.req.method, path: c.req.path, timestamp: new Date().toISOString() })}`,
  );

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

    console.log(
      `[users.login] success ${JSON.stringify({ userId: user.id, durationMs: Date.now() - startMs })}`,
    );

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
            isAdmin: user.isAdmin,
          },
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      `[users.login] failed ${JSON.stringify({ durationMs: Date.now() - startMs, error: String(error) })}`,
    );

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
  console.log(
    `[users.whoami] request received ${JSON.stringify({ method: c.req.method, path: c.req.path, timestamp: new Date().toISOString() })}`,
  );

  try {
    const reqWithUser = c.req as typeof c.req & Partial<AuthRequestUser>;
    const { userId, email, username, phoneNumber } = reqWithUser;

    if (!userId || !email || !username || !phoneNumber) {
      throw new HTTPException(401, { message: "Invalid token payload" });
    }

    console.log(
      `[users.whoami] success ${JSON.stringify({ userId, durationMs: Date.now() - startMs })}`,
    );

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
    console.error(
      `[users.whoami] failed ${JSON.stringify({ durationMs: Date.now() - startMs, error: String(error) })}`,
    );

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, {
      message: "Failed to fetch user profile",
    });
  }
};

export const approvePendingUser = async (
  c: Context<{ Bindings: AppBindings }>,
) => {
  const startMs = Date.now();
  console.log(
    `[users.approvePending] request received ${JSON.stringify({ method: c.req.method, path: c.req.path, timestamp: new Date().toISOString() })}`,
  );

  try {
    const reqWithUser = c.req as typeof c.req & Partial<AuthRequestUser>;
    const approverUserId = reqWithUser.userId;

    if (!approverUserId) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const body = await c.req.json();
    const parsed = approvePendingUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new HTTPException(400, {
        message: "Invalid approval payload",
        cause: parsed.error.flatten(),
      });
    }

    const { userId, superAccess, superAccessReason, comments } = parsed.data;

    const callerIsAdmin = await usersRepository.isAdmin(c, approverUserId);
    if (!callerIsAdmin) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const approveeUser = await usersRepository.findById(c, userId);
    if (!approveeUser) {
      throw new HTTPException(404, { message: "User not found" });
    }

    if (approveeUser.status !== USER_STATUS.PENDING) {
      throw new HTTPException(409, {
        message: "User is not in pending status",
      });
    }

    const nowIso = new Date().toISOString();
    await usersRepository.approvePendingUser(c, {
      approveeUserId: userId,
      approverUserId,
      superAccess,
      superAccessReason,
      comments,
      nowIso,
    });

    console.log(
      `[users.approvePending] success ${JSON.stringify({ approveeUserId: userId, approverUserId, durationMs: Date.now() - startMs })}`,
    );

    return c.json(
      {
        code: 200,
        message: "Pending user approved successfully",
        data: {
          userId,
          status: USER_STATUS.APPROVED,
          hasSuperAccess: superAccess,
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      `[users.approvePending] failed ${JSON.stringify({ durationMs: Date.now() - startMs, error: String(error) })}`,
    );

    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof PendingApprovalConflictError) {
      throw new HTTPException(409, {
        message: "User is no longer in pending status",
      });
    }

    throw new HTTPException(500, {
      message: "Failed to approve pending user",
    });
  }
};
