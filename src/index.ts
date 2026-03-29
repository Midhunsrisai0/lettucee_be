import { app } from "./app";
import { CallRoom } from "./modules/call-room/call-room.do";
import type { AppBindings } from "./types/env";

const worker: ExportedHandler<AppBindings> = {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    const roomMatch = url.pathname.match(/^\/room\/([^/]+)$/);

    if (roomMatch) {
      const roomId = decodeURIComponent(roomMatch[1]);
      console.log("[Worker] room route matched", {
        roomId,
        path: url.pathname,
      });

      const id = env.CALL_ROOM.idFromName(roomId);
      const stub = env.CALL_ROOM.get(id);

      console.log("[Worker] forwarding request to call room durable object", {
        roomId,
      });

      return stub.fetch(request);
    }

    return app.fetch(request, env, ctx);
  },
};

export default worker;
export { CallRoom };
