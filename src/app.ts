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
      code: 404,
      message: "Not Found",
      data: {
        path: c.req.path,
      },
    },
    404,
  ),
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        code: err.status,
        message: err.message,
        data: null,
      },
      err.status,
    );
  }

  console.error("Unhandled error", err);
  return c.json(
    {
      code: 500,
      message: "Internal Server Error",
      data: null,
    },
    500,
  );
});

export { app };
