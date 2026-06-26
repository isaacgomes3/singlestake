/**
 * Node.js não expõe WebSocket global (ao contrário do browser).
 * Em produção o polyfill principal está em deploy/node-preload.mjs (PM2 --import).
 * Este módulo cobre dev e fallback se o preload não correu.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.WS_NO_BUFFER_UTIL ??= "1";
process.env.WS_NO_UTF_8_VALIDATE ??= "1";

let WS: typeof import("ws");
try {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  WS = createRequire(join(root, "package.json"))("ws") as typeof import("ws");
} catch (err) {
  console.error("[Roleta] FALHA ao carregar ws:", err);
  throw err;
}

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
    try {
      if (this.ws.readyState === WS.CLOSING || this.ws.readyState === WS.CLOSED) return;
      this.ws.close(code, reason);
    } catch (err) {
      console.warn("[Roleta] ws.close ignorado:", err);
    }
  }
}

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
    NodeWebSocket as unknown as typeof WebSocket;
  console.log("[Roleta] WebSocket polyfill (ws) activo no Node");
}
