export type AppBindings = {
  DB: D1Database;
  CALL_ROOM: DurableObjectNamespace;
  APPROVAL_QUEUE: Queue<ApprovalQueueJob>;
  HEALTH_CHECK_QUEUE: Queue<HealthJobQueue>;
  SYNC_CONTACTS_QUEUE: Queue<SyncContactsJob>;
  APP_NAME: string;
  APP_ENV: "development" | "staging" | "production";
  JWT_SECRET: string;
};

export type ApprovalQueueJob = {
  tupleId: string;
  approveeUserId: string;
};

export type HealthJobQueue = {
  jobId: string;
  message: string;
};

export type SyncContactsJob = {
  userId: string;
  phoneNumbers: string[];
};
