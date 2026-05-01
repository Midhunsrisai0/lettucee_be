import type { Context } from "hono";
import { eq } from "drizzle-orm";
import type { AppBindings, ApprovalQueueJob } from "../types/env";
import { getDrizzleDb } from "./drizzle";
import { chitti, pandu } from "../db/schema";

export const processApprovalQueue = async (
  c: Context<{ Bindings: AppBindings }>,
  job: ApprovalQueueJob,
) => {
  const db = getDrizzleDb(c);
  const { tupleId, approveeUserId } = job;
  const nowIso = new Date().toISOString();

  console.log("[approval-queue] processing job", {
    tupleId,
    approveeUserId,
  });

  try {
    // Step 1: Fetch the chitti tuple by id
    const tuple = await db
      .select()
      .from(chitti)
      .where(eq(chitti.id, tupleId))
      .limit(1);

    if (!tuple[0]) {
      console.warn("[approval-queue] tuple not found", {
        tupleId,
      });
      return;
    }

    const sourceUserId = tuple[0].source;

    // Step 2: Update tuple destination to approvee's user id
    await db
      .update(chitti)
      .set({
        destination: approveeUserId,
        updatedAt: nowIso,
      })
      .where(eq(chitti.id, tupleId));

    console.log("[approval-queue] tuple destination updated", {
      tupleId,
      destination: approveeUserId,
    });

    // Step 3: Fetch source user's pandu record
    const sourceUserPandu = await db
      .select()
      .from(pandu)
      .where(eq(pandu.userId, sourceUserId))
      .limit(1);

    if (!sourceUserPandu[0]) {
      console.warn("[approval-queue] source user pandu not found", {
        sourceUserId,
      });
      return;
    }

    // Step 4: Parse adjacency list and add approvee if not already present
    let adjacencyList: string[] = [];
    try {
      adjacencyList = JSON.parse(sourceUserPandu[0].adjacencyList);
    } catch (parseErr) {
      console.warn("[approval-queue] failed to parse adjacency list", {
        sourceUserId,
        error: parseErr,
      });
      adjacencyList = [];
    }

    if (!adjacencyList.includes(approveeUserId)) {
      adjacencyList.push(approveeUserId);

      // Update pandu with new adjacency list
      await db
        .update(pandu)
        .set({
          adjacencyList: JSON.stringify(adjacencyList),
          updatedAt: nowIso,
        })
        .where(eq(pandu.userId, sourceUserId));

      console.log("[approval-queue] adjacency list updated", {
        sourceUserId,
        approveeUserId,
        newCount: adjacencyList.length,
      });
    } else {
      console.log("[approval-queue] approvee already in adjacency list", {
        sourceUserId,
        approveeUserId,
      });
    }
  } catch (error) {
    console.error("[approval-queue] failed to process job", {
      tupleId,
      approveeUserId,
      error,
    });
    throw error;
  }
};

export const queueApprovalJob = async (
  c: Context<{ Bindings: AppBindings }>,
  tupleId: string,
  approveeUserId: string,
) => {
  const queue = c.env.APPROVAL_QUEUE;

  const job: ApprovalQueueJob = {
    tupleId,
    approveeUserId,
  };

  await queue.send(job);

  console.log("[approval-queue] job queued", {
    tupleId,
    approveeUserId,
  });
};
