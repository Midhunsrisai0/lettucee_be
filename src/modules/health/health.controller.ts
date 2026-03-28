import type { Context } from "hono";
import type { AppBindings } from "../../types/env";

export const healthCheck = (c: Context<{ Bindings: AppBindings }>) => {
  console.log("[health] request received", {
    method: c.req.method,
    path: c.req.path,
    env: c.env.APP_ENV,
    timestamp: new Date().toISOString(),
    status: "ok",
  });

  return c.json(
    {
      ok: true,
      app: c.env.APP_NAME,
      env: c.env.APP_ENV,
      timestamp: new Date().toISOString(),
    },
    200,
  );
};
