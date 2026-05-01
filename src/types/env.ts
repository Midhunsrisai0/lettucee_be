export type AppBindings = {
  DB: D1Database;
  CALL_ROOM: DurableObjectNamespace;
  APPROVAL_QUEUE: Queue<ApprovalQueueJob>;
  HEALTH_CHECK_QUEUE: Queue<HealthJobQueue>;
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
