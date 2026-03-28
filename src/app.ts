import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import type { AppBindings } from "./types/env";
import { apiRoutes } from "./routes";

const app = new Hono<{ Bindings: AppBindings }>();

app.use("*", cors());

app.route("/", apiRoutes);

app.notFound((c) =>
  c.json(
    {
      error: "Not Found",
      path: c.req.path,
    },
    404,
  ),
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
      },
      err.status,
    );
  }

  console.error("Unhandled error", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

export { app };
