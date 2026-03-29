type DurableObjectEnv = {
  CALL_ROOM: DurableObjectNamespace;
};

export class CallRoom implements DurableObject {
  private readonly clients = new Set<WebSocket>();

  constructor(
    private readonly _state: DurableObjectState,
    private readonly _env: DurableObjectEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    console.log("[CallRoom] fetch received", {
      method: request.method,
      url: request.url,
      clientCount: this.clients.size,
    });

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() !== "websocket") {
      console.log("[CallRoom] rejected non-websocket request", {
        upgradeHeader,
      });
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.clients.add(server);
    console.log("[CallRoom] websocket connected", {
      clientCount: this.clients.size,
    });

    const cleanup = () => {
      this.clients.delete(server);
      console.log("[CallRoom] websocket cleaned up", {
        clientCount: this.clients.size,
      });
    };

    server.addEventListener("message", (event: MessageEvent) => {
      let recipients = 0;
      for (const socket of this.clients) {
        if (socket !== server && socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
          recipients += 1;
        }
      }

      console.log("[CallRoom] message broadcast", {
        recipients,
      });
    });

    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}
