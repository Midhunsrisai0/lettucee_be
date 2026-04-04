export type AppBindings = {
  DB: D1Database;
  CALL_ROOM: DurableObjectNamespace;
  APP_NAME: string;
  APP_ENV: "development" | "staging" | "production";
  JWT_SECRET: string;
};
