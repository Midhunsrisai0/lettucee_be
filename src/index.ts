import { app } from "./app";
import { CallRoom } from "./modules/call-room/call-room.do";
import type { AppBindings } from "./types/env";

const worker: ExportedHandler<AppBindings> = {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    const roomMatch = url.pathname.match(/^\/room\/([^/]+)$/);

    if (roomMatch) {
      const roomId = decodeURIComponent(roomMatch[1]);
      const id = env.CALL_ROOM.idFromName(roomId);
      const stub = env.CALL_ROOM.get(id);
      return stub.fetch(request);
    }

    return app.fetch(request, env, ctx);
  },
};

export default worker;
export { CallRoom };
