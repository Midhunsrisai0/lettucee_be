import type { MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import type { AppBindings } from "../types/env";

export type AuthUserPayload = JWTPayload & {
  sub: string;
  email: string;
  phoneNumber: string;
  username: string;
  status: string;
};

export type AuthRequestUser = {
  userId: string;
  email: string;
  username: string;
  phoneNumber: string;
};

type AuthContext = {
  Bindings: AppBindings;
  Variables: {
    userId: string;
    email: string;
    username: string;
    phoneNumber: string;
  };
};

const getBearerToken = (authorizationHeader?: string | null): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

export const authMiddleware: MiddlewareHandler<AuthContext> = async (
  c,
  next,
) => {
  const authHeader = c.req.header("Authorization");
  const token = getBearerToken(authHeader);

  if (!token) {
    return c.json(
      {
        code: 401,
        message: "Authorization token missing",
        data: null,
      },
      401,
    );
  }

  try {
    const payload = (await verify(
      token,
      c.env.JWT_SECRET,
      "HS256",
    )) as AuthUserPayload;

    const authUser: AuthRequestUser = {
      userId: payload.sub,
      email: payload.email,
      username: payload.username,
      phoneNumber: payload.phoneNumber,
    };

    c.set("userId", authUser.userId);
    c.set("email", authUser.email);
    c.set("username", authUser.username);
    c.set("phoneNumber", authUser.phoneNumber);

    // Expose user data directly on request object for downstream handlers.
    const requestWithUser = c.req as typeof c.req & Partial<AuthRequestUser>;
    requestWithUser.userId = authUser.userId;
    requestWithUser.email = authUser.email;
    requestWithUser.username = authUser.username;
    requestWithUser.phoneNumber = authUser.phoneNumber;

    await next();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message.toLowerCase() : "";
    const isExpired = errMsg.includes("expired");

    return c.json(
      {
        code: 401,
        message: isExpired ? "Token expired" : "Invalid token",
        data: null,
      },
      401,
    );
  }
};
