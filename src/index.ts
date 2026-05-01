import { app } from "./app";
import { CallRoom } from "./modules/call-room/call-room.do";
import type { AppBindings, ApprovalQueueJob } from "./types/env";
import { processApprovalQueue } from "./queues/adjacency-queue";
import { processSyncContactsQueue } from "./queues/sync-contacts-queue";
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
            console.log(
              `[Worker] processing approval queue message ${JSON.stringify({ messageId: message.id })}`,
            );
            const job = message.body as ApprovalQueueJob;

            const mockContext = {
              env,
              waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
            } as any;

            await processApprovalQueue(mockContext, job);
            console.log(
              `[Worker] approval queue message processed ${JSON.stringify({ tupleId: job.tupleId, approveeUserId: job.approveeUserId })}`,
            );

            message.ack(); // Acknowledge completion
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
            const job = message.body as any;
            await healthQueueConsumer(job);

            message.ack(); // Acknowledge completion
          } catch (error) {
            console.error(
              `[Worker] health-check queue message processing failed ${JSON.stringify({ error: String(error), message: message.body })}`,
            );
            throw error;
          }
        }
        break;

      case "sync-contacts-jobs":
        // Process jobs concurrently for higher throughput
        await Promise.all(
          batch.messages.map(async (message) => {
            try {
              console.log(
                `[Worker] processing sync contacts queue message ${JSON.stringify({ messageId: message.id })}`,
              );
              const job = message.body as any;

              const mockContext = {
                env,
                waitUntil: (promise: Promise<any>) => ctx.waitUntil(promise),
              } as any;

              await processSyncContactsQueue(mockContext, job);

              console.log(
                `[Worker] sync-contacts queue message processed ${JSON.stringify({ userId: job.userId, phoneCount: job.phoneNumbers.length })}`,
              );

              message.ack(); // Acknowledge completion for this individual message
            } catch (error) {
              console.error(
                `[Worker] sync-contacts queue message processing failed ${JSON.stringify({ error: String(error), message: message.body })}`,
              );
              message.retry({ delaySeconds: 60 }); // Retry just this message
            }
          }),
        );
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
