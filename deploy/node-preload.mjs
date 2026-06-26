/**
 * Carregado via PM2/node --import ANTES da app (.output/server/index.mjs).
 * Garante WebSocket global usando `ws` de node_modules (fora do bundle Nitro).
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.WS_NO_BUFFER_UTIL ??= "1";
process.env.WS_NO_UTF_8_VALIDATE ??= "1";

if (typeof globalThis.WebSocket !== "undefined") {
  console.log("[preload] WebSocket global já disponível");
} else {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const require = createRequire(join(root, "package.json"));

  let WS;
  try {
    WS = require("ws");
  } catch (err) {
    console.error("[preload] FALHA: pacote ws não encontrado — corra npm install em", root);
    console.error(err);
    process.exit(1);
  }

  class NodeWebSocket extends EventTarget {
    constructor(url, _protocols) {
      super();
      const href = typeof url === "string" ? url : url.href;
      this._ws = new WS(href);

      this._ws.on("open", () => this.dispatchEvent(new Event("open")));

      this._ws.on("message", (data, isBinary) => {
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

      this._ws.on("error", (err) => {
        this.dispatchEvent(new ErrorEvent("error", { error: err, message: err.message }));
      });

      this._ws.on("close", (code, reason) => {
        this.dispatchEvent(
          new CloseEvent("close", {
            code,
            reason: reason.toString("utf8"),
            wasClean: code === 1000,
          }),
        );
      });
    }

    get CONNECTING() {
      return WS.CONNECTING;
    }
    get OPEN() {
      return WS.OPEN;
    }
    get CLOSING() {
      return WS.CLOSING;
    }
    get CLOSED() {
      return WS.CLOSED;
    }

    get readyState() {
      return this._ws.readyState;
    }

    send(data) {
      this._ws.send(data);
    }

    close(code, reason) {
      try {
        if (this._ws.readyState === WS.CLOSING || this._ws.readyState === WS.CLOSED) return;
        this._ws.close(code, reason);
      } catch (err) {
        console.warn("[preload] ws.close ignorado:", err);
      }
    }
  }

  globalThis.WebSocket = NodeWebSocket;
  console.log("[preload] WebSocket polyfill (ws) activo — root:", root);
}
