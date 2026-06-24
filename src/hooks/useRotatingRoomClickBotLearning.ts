import { useEffect, useRef, useState } from "react";

import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import {
  executeRotatingRoomClickBotTarget,
  planRotatingRoomClickBotActions,
  ROTATING_ROOM_INDICATION_PANEL_ID,
  rotatingRoomClickBotSessionFingerprint,
  type RotatingRoomClickBotAction,
} from "@/lib/roulette/rotatingRoomClickBotLearning";
import {
  buildRotatingRoomExtensionContext,
  emitRotatingRoomExtensionBridge,
} from "@/lib/roulette/rotatingRoomExtensionBridge";

export type ClickBotLearningMode = "dry" | "click" | "extension";

export type ClickBotLogEntry = {
  id: number;
  at: string;
  fingerprint: string;
  actions: RotatingRoomClickBotAction[];
  executed?: { target: string; ok: boolean; detail: string }[];
  extensionAck?: boolean;
};

const MAX_LOG = 40;
const CLICK_STAGGER_MS = 450;
const EXTENSION_ACK_TIMEOUT_MS = 6000;

type Options = {
  session: RotatingRoomCrossingSession | RotatingRoomUmFatorSession;
  enabled: boolean;
  mode: ClickBotLearningMode;
};

export function useRotatingRoomClickBotLearning({ session, enabled, mode }: Options) {
  const [log, setLog] = useState<ClickBotLogEntry[]>([]);
  const lastFingerprintRef = useRef<string | null>(null);
  const logIdRef = useRef(0);

  const sessionSlice = {
    sessionMode: session.sessionMode,
    showTapeteSignal: session.showTapeteSignal,
    prepareTableId: session.prepareTableId,
    currentTableId: session.currentTableId,
    activeCrossing: session.activeCrossing,
  };

  const fingerprint = rotatingRoomClickBotSessionFingerprint(sessionSlice);

  useEffect(() => {
    if (!enabled) return;
    if (fingerprint === lastFingerprintRef.current) return;
    lastFingerprintRef.current = fingerprint;

    const actions = planRotatingRoomClickBotActions(sessionSlice);
    const at = new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const entryId = ++logIdRef.current;

    if (mode === "extension") {
      const context = buildRotatingRoomExtensionContext(sessionSlice);
      emitRotatingRoomExtensionBridge({ fingerprint, actions, context });
      setLog((prev) =>
        [{ id: entryId, at, fingerprint, actions, extensionAck: false }, ...prev].slice(0, MAX_LOG),
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
      return;
    }

    if (mode === "click") {
      const root = document.getElementById(ROTATING_ROOM_INDICATION_PANEL_ID);
      const clicks = actions.filter((a) => a.kind === "click");
      const executed: ClickBotLogEntry["executed"] = [];

      clicks.forEach((action, index) => {
        window.setTimeout(() => {
          const result = executeRotatingRoomClickBotTarget(
            action.target,
            root ?? document,
          );
          executed.push({ target: action.target, ...result });
          if (index === clicks.length - 1) {
            setLog((prev) => {
              const row: ClickBotLogEntry = {
                id: entryId,
                at,
                fingerprint,
                actions,
                executed: [...executed],
              };
              return [row, ...prev].slice(0, MAX_LOG);
            });
          }
        }, index * CLICK_STAGGER_MS);
      });

      if (clicks.length === 0) {
        setLog((prev) =>
          [{ id: entryId, at, fingerprint, actions }, ...prev].slice(0, MAX_LOG),
        );
      }
    } else {
      setLog((prev) =>
        [{ id: entryId, at, fingerprint, actions }, ...prev].slice(0, MAX_LOG),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mode, fingerprint]);

  useEffect(() => {
    if (!enabled || mode !== "extension") return;

    const onAck = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        fingerprint?: string;
        response?: { results?: ClickBotLogEntry["executed"] };
      };
      if (!data || data.type !== "game-odds-glow/rotating-room-extension-ack") return;
      const fp = typeof data.fingerprint === "string" ? data.fingerprint : "";
      const results = data.response?.results;
      setLog((prev) =>
        prev.map((row) =>
          row.fingerprint === fp && row.extensionAck === false
            ? { ...row, extensionAck: true, executed: results }
            : row,
        ),
      );
    };

    window.addEventListener("message", onAck);
    return () => window.removeEventListener("message", onAck);
  }, [enabled, mode]);

  useEffect(() => {
    if (!enabled) lastFingerprintRef.current = null;
  }, [enabled]);

  const clearLog = () => setLog([]);

  return { log, clearLog, currentPlan: planRotatingRoomClickBotActions(sessionSlice) };
}
