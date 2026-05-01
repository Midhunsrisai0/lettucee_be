import type { Context } from "hono";
import type { AppBindings, ApprovalQueueJob } from "../types/env";
import { networkRepository } from "../modules/network/network.repository";

export const processApprovalQueue = async (
  c: Context<{ Bindings: AppBindings }>,
  job: ApprovalQueueJob,
) => {
  await networkRepository.processApprovalQueueJob(c, job);
};

export const queueApprovalJob = async (
  c: Context<{ Bindings: AppBindings }>,
  tupleId: string,
  approveeUserId: string,
) => {
  const job: ApprovalQueueJob = {
    tupleId,
    approveeUserId,
  };

  await c.env.APPROVAL_QUEUE.send(job);

  console.log(
    `[approval-queue] job queued ${JSON.stringify({ tupleId, approveeUserId })}`,
  );
};
