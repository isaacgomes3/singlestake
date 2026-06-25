import { useEffect, useState } from "react";

import type { ClickBotLogEntry } from "@/hooks/useRotatingRoomClickBotLearning";
import { ROTATING_ROOM_EXTENSION_ACK_TYPE, ROTATING_ROOM_EXTENSION_EMIT_EVENT } from "@/lib/roulette/rotatingRoomExtensionBridge";

const MAX_LOG = 40;
const EXTENSION_ACK_TIMEOUT_MS = 6000;

type EmitDetail = {
  fingerprint: string;
  actions: ClickBotLogEntry["actions"];
};

export function useRotatingRoomExtensionAckLog(enabled: boolean) {
  const [log, setLog] = useState<ClickBotLogEntry[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const onEmit = (event: Event) => {
      const detail = (event as CustomEvent<EmitDetail>).detail;
      if (!detail?.fingerprint || !Array.isArray(detail.actions)) return;

      const entryId = Date.now();
      const at = new Date().toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setLog((prev) =>
        [
          {
            id: entryId,
            at,
            fingerprint: detail.fingerprint,
            actions: detail.actions,
            extensionAck: false,
          },
          ...prev,
        ].slice(0, MAX_LOG),
      );

      window.setTimeout(() => {
        setLog((prev) =>
          prev.map((row) =>
            row.id === entryId && row.extensionAck === false
              ? {
                  ...row,
                  extensionAck: true,
                  executed: [
                    {
                      target: "bridge",
                      ok: false,
                      detail:
                        "Sem resposta da extensão — recarregue a página (F5) e a extensão em chrome://extensions",
                    },
                  ],
                }
              : row,
          ),
        );
      }, EXTENSION_ACK_TIMEOUT_MS);
    };

    const onAck = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        fingerprint?: string;
        response?: { results?: ClickBotLogEntry["executed"] };
      };
      if (!data || data.type !== ROTATING_ROOM_EXTENSION_ACK_TYPE) return;
      const fp = typeof data.fingerprint === "string" ? data.fingerprint : "";
      const raw = data.response?.results;
      const executed = Array.isArray(raw)
        ? raw.map((r) => {
            const row = r as { target?: string; ok?: boolean; detail?: string };
            return {
              target: typeof row.target === "string" ? row.target : "bridge",
              ok: row.ok === true,
              detail: typeof row.detail === "string" ? row.detail : "Resposta da extensão",
            };
          })
        : undefined;

      setLog((prev) =>
        prev.map((row) =>
          row.fingerprint === fp && row.extensionAck === false
            ? { ...row, extensionAck: true, executed }
            : row,
        ),
      );
    };

    window.addEventListener(ROTATING_ROOM_EXTENSION_EMIT_EVENT, onEmit);
    window.addEventListener("message", onAck);
    return () => {
      window.removeEventListener(ROTATING_ROOM_EXTENSION_EMIT_EVENT, onEmit);
      window.removeEventListener("message", onAck);
    };
  }, [enabled]);

  return log;
}
