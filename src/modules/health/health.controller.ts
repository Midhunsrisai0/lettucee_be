import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppBindings } from "../../types/env";

export const healthCheck = (c: Context<{ Bindings: AppBindings }>) => {
  const startMs = Date.now();
  console.log("[health] request received", {
    method: c.req.method,
    path: c.req.path,
    env: c.env.APP_ENV,
    timestamp: new Date().toISOString(),
  });

  try {
    const response = {
      code: 200,
      message: "Health check successful",
      data: {
        ok: true,
        app: c.env.APP_NAME,
        env: c.env.APP_ENV,
        timestamp: new Date().toISOString(),
      },
    };

    console.log("[health] success", {
      durationMs: Date.now() - startMs,
      status: "ok",
    });

    return c.json(response, 200);
  } catch (error) {
    console.error("[health] failed", {
      durationMs: Date.now() - startMs,
      error,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, { message: "Health check failed" });
  }
};
