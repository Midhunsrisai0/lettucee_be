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
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.clients.add(server);

    const cleanup = () => {
      this.clients.delete(server);
    };

    server.addEventListener("message", (event: MessageEvent) => {
      for (const socket of this.clients) {
        if (socket !== server && socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      }
    });

    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}
