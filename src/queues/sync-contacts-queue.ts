import type { Context } from "hono";
import type { AppBindings, SyncContactsJob } from "../types/env";
import { networkRepository } from "../modules/network/network.repository";

export const processSyncContactsQueue = async (
  c: Context<{ Bindings: AppBindings }>,
  job: SyncContactsJob,
) => {
  const { userId, phoneNumbers } = job;
  const startMs = Date.now();

  console.log(
    `[sync-contacts-queue] processing job ${JSON.stringify({ userId, phoneCount: phoneNumbers.length })}`,
  );

  try {
    const result = await networkRepository.syncContacts(c, userId, phoneNumbers);

    console.log(
      `[sync-contacts-queue] job completed ${JSON.stringify({ userId, synced: result.synced, resolved: result.resolved, durationMs: Date.now() - startMs })}`,
    );
  } catch (error) {
    console.error(
      `[sync-contacts-queue] job failed ${JSON.stringify({ userId, error: String(error), durationMs: Date.now() - startMs })}`,
    );
    throw error;
  }
};

export const queueSyncContactsJob = async (
  c: Context<{ Bindings: AppBindings }>,
  userId: string,
  phoneNumbers: string[],
) => {
  const job: SyncContactsJob = {
    userId,
    phoneNumbers,
  };

  await c.env.SYNC_CONTACTS_QUEUE.send(job);

  console.log(
    `[sync-contacts-queue] job queued ${JSON.stringify({ userId, phoneCount: phoneNumbers.length })}`,
  );
};
