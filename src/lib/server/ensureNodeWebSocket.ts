/**
 * Node.js não expõe WebSocket global (ao contrário do browser).
 * Os sockets DGA (roleta, 24D, football blitz) usam addEventListener — este adapter
 * implementa a API standard em cima do pacote `ws`.
 */
import WS from "ws";

class NodeWebSocket extends EventTarget {
  private readonly ws: WS;

  readonly CONNECTING = WS.CONNECTING;
  readonly OPEN = WS.OPEN;
  readonly CLOSING = WS.CLOSING;
  readonly CLOSED = WS.CLOSED;

  constructor(url: string | URL, _protocols?: string | string[]) {
    super();
    const href = typeof url === "string" ? url : url.href;
    this.ws = new WS(href);

    this.ws.on("open", () => {
      this.dispatchEvent(new Event("open"));
    });

    this.ws.on("message", (data: WS.RawData, isBinary: boolean) => {
      const payload =
        typeof data === "string"
          ? data
          : isBinary
            ? data
            : Buffer.isBuffer(data)
              ? data.toString("utf8")
              : String(data);
      this.dispatchEvent(new MessageEvent("message", { data: payload }));
    });

    this.ws.on("error", (err: Error) => {
      this.dispatchEvent(new ErrorEvent("error", { error: err, message: err.message }));
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      this.dispatchEvent(
        new CloseEvent("close", {
          code,
          reason: reason.toString("utf8"),
          wasClean: code === 1000,
        }),
      );
    });
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    this.ws.send(data);
  }

  close(code?: number, reason?: string): void {
    this.ws.close(code, reason);
  }
}

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
    NodeWebSocket as unknown as typeof WebSocket;
  console.log("[Roleta] WebSocket polyfill (ws) activo no Node");
}
