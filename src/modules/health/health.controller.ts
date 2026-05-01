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

export const healthQueueProducer = async (
  c: Context<{ Bindings: AppBindings }>,
) => {
  try {
    console.log("[health] queue producer triggered", {
      timestamp: new Date().toISOString(),
    });
    const jobId = `health-job-${Date.now()}`;
    const message = `Health check queue message at ${new Date().toISOString()}`;

    const queue = c.env.HEALTH_CHECK_QUEUE;
    await queue.send({
      jobId,
      message,
    });
    console.log("[health] queue producer success", {
      jobId,
    });

    return c.json(
      {
        code: 200,
        message: "Health job queued successfully",
        data: { jobId },
      },
      200,
    );
  } catch (error) {
    console.error("[health] queue producer failed", {
      error,
    });
    throw new HTTPException(500, { message: "Failed to enqueue health job" });
  }
};

export const healthQueueConsumer = async (message: any) => {
  try {
    console.log("[healthQueueConsumer] processing job", {
      jobId: message.jobId,
      message: message.message,
    });
    // Simulate some processing work
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("[healthQueueConsumer] job processed successfully", {
      jobId: message.jobId,
    });
  } catch (error) {
    console.error("[healthQueueConsumer] failed to process job", {
      jobId: message.jobId,
      error,
    });
    throw error; // Re-throw to trigger retry if needed
  }
};
