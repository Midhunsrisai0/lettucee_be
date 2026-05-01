import { app } from "./app";
import { CallRoom } from "./modules/call-room/call-room.do";
import type { AppBindings, ApprovalQueueJob } from "./types/env";
import { processApprovalQueue } from "./lib/adjacency-queue";
import { healthQueueConsumer } from "./modules/health/health.controller";

const worker: ExportedHandler<AppBindings> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const roomMatch = url.pathname.match(/^\/room\/([^/]+)$/);

    if (roomMatch) {
      const roomId = decodeURIComponent(roomMatch[1]);
      console.log(
        `[Worker] room route matched ${JSON.stringify({ roomId, path: url.pathname })}`,
      );

      const id = env.CALL_ROOM.idFromName(roomId);
      const stub = env.CALL_ROOM.get(id);

      console.log(
        `[Worker] forwarding request to call room durable object ${JSON.stringify({ roomId })}`,
      );

      return stub.fetch(request);
    }

    return app.fetch(request, env, ctx);
  },

  async queue(batch, env, ctx) {
    console.log(
      `[Worker] queue consumer triggered ${JSON.stringify({ queue: batch.queue, messageCount: batch.messages.length })}`,
    );

    switch (batch.queue) {
      case "lettucee-approval-jobs":
        for (const message of batch.messages) {
          try {
            const job = message.body as ApprovalQueueJob;

            const mockContext = {
              env,
              waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
            } as any;

            await processApprovalQueue(mockContext, job);
            console.log(
              `[Worker] approval queue message processed ${JSON.stringify({ tupleId: job.tupleId, approveeUserId: job.approveeUserId })}`,
            );
          } catch (error) {
            console.error("[Worker] approval queue message processing failed", {
              error,
              message: message.body,
            });
            throw error; // Re-throw to trigger batch retry
          }
        }
        break;
      case "health-check-jobs":
        for (const message of batch.messages) {
          try {
            console.log("[Worker] processing health check queue message");
            const job = message.body as any; // Define a type if needed
            await healthQueueConsumer(job);
          } catch (error) {
            console.error(
              `[Worker] approval queue message processing failed ${JSON.stringify({ error: String(error), message: message.body })}`,
            );
            throw error; // Re-throw to trigger batch retry
          }
        }
        break;
      default:
        console.warn(
          `[Worker] unknown queue received ${JSON.stringify({ queue: batch.queue, messageCount: batch.messages.length })}`,
        );
        break;
    }
  },
};

export default worker;
export { CallRoom };
