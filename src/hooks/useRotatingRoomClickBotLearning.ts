import { useEffect, useRef, useState } from "react";

import type { RotatingRoomRotativaSession } from "@/hooks/useRotatingRoomRotativaSession";
import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import { umFatorToTapeteActive } from "@/lib/roulette/umFatorStrategy";
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
  emitRotatingRoomExtensionCloseMesa,
  mesaUrlForTableId,
  ROTATING_ROOM_EXTENSION_ACK_TYPE,
} from "@/lib/roulette/rotatingRoomExtensionBridge";
import {
  clearExtensionLastEmitKey,
  readExtensionLastEmitKey,
  writeExtensionLastEmitKey,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";
import {
  isRotatingRoomLobbyWait,
  isRotatingRoomPostResultHoldActive,
  type RotatingRoomLobbySession,
} from "@/lib/roulette/rotatingRoomLobbySignal";

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
  session: RotatingRoomCrossingSession | RotatingRoomUmFatorSession | RotatingRoomRotativaSession;
  enabled: boolean;
  mode: ClickBotLearningMode;
  /** URL do operador em uso (iframe / guardada) — tem prioridade sobre defaults Pragmatic. */
  mesaEmbedUrl?: string | null;
  /** Banca do quadro global — extensão calcula stake localmente. */
  automationBalance?: number | null;
};

function sessionToSlice(
  session: RotatingRoomCrossingSession | RotatingRoomUmFatorSession,
) {
  if ("rotativaTrigger" in session && session.rotativaTrigger === "fibonacci") {
    return {
      sessionMode: session.sessionMode,
      showTapeteSignal: false,
      prepareTableId: session.prepareTableId,
      currentTableId: session.currentTableId,
      activeCrossing: null,
      singleFactorMode: true,
      signalId: null,
      betAttemptKey: null,
      rotativaTrigger: "fibonacci" as const,
      currentRecovery: session.currentRecovery,
      lobbyWait:
        !isRotatingRoomPostResultHoldActive(
          "postResultHoldUntilMs" in session ? session.postResultHoldUntilMs : null,
        ) && isRotatingRoomLobbyWait(session as RotatingRoomLobbySession),
      lobbyCooldownActive:
        "lobbyCooldownActive" in session && session.lobbyCooldownActive === true,
      postResultHoldActive:
        "postResultHoldActive" in session && session.postResultHoldActive === true,
      postResultHoldUntilMs:
        "postResultHoldUntilMs" in session &&
        typeof session.postResultHoldUntilMs === "number" &&
        Number.isFinite(session.postResultHoldUntilMs)
          ? session.postResultHoldUntilMs
          : null,
      postResultHoldTableId:
        "postResultHoldTableId" in session &&
        typeof session.postResultHoldTableId === "number" &&
        Number.isFinite(session.postResultHoldTableId)
          ? session.postResultHoldTableId
          : null,
      lobbyCooldownUntilMs:
        "lobbyCooldownUntilMs" in session &&
        typeof session.lobbyCooldownUntilMs === "number" &&
        Number.isFinite(session.lobbyCooldownUntilMs)
          ? session.lobbyCooldownUntilMs
          : null,
    };
  }

  const rotativaTrigger =
    "rotativaTrigger" in session && session.rotativaTrigger === "crossing"
      ? "crossing"
      : "umFator";
  const singleFactorMode =
    rotativaTrigger === "umFator" &&
    ("singleFactorMode" in session ? session.singleFactorMode === true : true);
  const umActive = "umActive" in session ? session.umActive : null;
  let activeCrossing = session.activeCrossing;
  if (!activeCrossing && singleFactorMode && umActive) {
    activeCrossing = umFatorToTapeteActive(umActive);
  }

  let signalId: string | null = null;
  let betAttemptKey: string | null = null;
  if (singleFactorMode && umActive && session.currentTableId != null) {
    signalId = `${session.currentTableId}:${umActive.resultNumber}:${umActive.alertFactor.kind}:${session.currentRecovery}`;
    betAttemptKey = signalId;
  } else if (activeCrossing && session.currentTableId != null) {
    const head =
      "lastEvaluatedHead" in session && session.lastEvaluatedHead
        ? session.lastEvaluatedHead
        : `s${"cycleSpinsWithoutWin" in session ? session.cycleSpinsWithoutWin ?? 0 : 0}`;
    betAttemptKey = `${session.currentTableId}:${activeCrossing.pairKind}:${session.currentRecovery}:${head}`;
    signalId = betAttemptKey;
  }

  return {
    sessionMode: session.sessionMode,
    showTapeteSignal: session.showTapeteSignal,
    prepareTableId: session.prepareTableId,
    currentTableId: session.currentTableId,
    activeCrossing,
    singleFactorMode,
    signalId,
    betAttemptKey,
    rotativaTrigger,
    currentRecovery: session.currentRecovery,
    lobbyWait:
      !isRotatingRoomPostResultHoldActive(
        "postResultHoldUntilMs" in session ? session.postResultHoldUntilMs : null,
      ) && isRotatingRoomLobbyWait(session as RotatingRoomLobbySession),
    lobbyCooldownActive:
      "lobbyCooldownActive" in session && session.lobbyCooldownActive === true,
    postResultHoldActive:
      "postResultHoldActive" in session && session.postResultHoldActive === true,
    postResultHoldUntilMs:
      "postResultHoldUntilMs" in session &&
      typeof session.postResultHoldUntilMs === "number" &&
      Number.isFinite(session.postResultHoldUntilMs)
        ? session.postResultHoldUntilMs
        : null,
    postResultHoldTableId:
      "postResultHoldTableId" in session &&
      typeof session.postResultHoldTableId === "number" &&
      Number.isFinite(session.postResultHoldTableId)
        ? session.postResultHoldTableId
        : null,
    lobbyCooldownUntilMs:
      "lobbyCooldownUntilMs" in session &&
      typeof session.lobbyCooldownUntilMs === "number" &&
      Number.isFinite(session.lobbyCooldownUntilMs)
        ? session.lobbyCooldownUntilMs
        : null,
  };
}

export function useRotatingRoomClickBotLearning({ session, enabled, mode, mesaEmbedUrl, automationBalance }: Options) {
  const [log, setLog] = useState<ClickBotLogEntry[]>([]);
  const lastFingerprintRef = useRef<string | null>(null);
  const logIdRef = useRef(0);

  const sessionSlice = sessionToSlice(session);
  const fingerprint = rotatingRoomClickBotSessionFingerprint(sessionSlice);
  const prevShowTapeteRef = useRef(false);
  const prevEmitKeyRef = useRef<string | null>(null);
  const mesaTabTableIdRef = useRef<number | null>(null);

  const prevPostResultHoldRef = useRef(false);

  useEffect(() => {
    if (mode !== "extension" || !enabled) return;

    const postHoldActive = sessionSlice.postResultHoldActive === true;
    const postHoldTableId = sessionSlice.postResultHoldTableId ?? null;

    if (postHoldActive && !prevPostResultHoldRef.current && postHoldTableId != null) {
      emitRotatingRoomExtensionCloseMesa(postHoldTableId, mesaUrlForTableId(postHoldTableId));
      mesaTabTableIdRef.current = null;
    }
    prevPostResultHoldRef.current = postHoldActive;
  }, [
    enabled,
    mode,
    sessionSlice.postResultHoldActive,
    sessionSlice.postResultHoldTableId,
  ]);

  useEffect(() => {
    if (mode !== "extension" || !enabled) return;
    if (sessionSlice.postResultHoldActive || sessionSlice.lobbyCooldownActive) return;

    const wasActive = prevShowTapeteRef.current;
    const isActive = sessionSlice.showTapeteSignal;
    prevShowTapeteRef.current = isActive;

    if (isActive && sessionSlice.currentTableId != null) {
      mesaTabTableIdRef.current = sessionSlice.currentTableId;
      return;
    }

    if (wasActive && !isActive && mesaTabTableIdRef.current != null) {
      emitRotatingRoomExtensionCloseMesa(
        mesaTabTableIdRef.current,
        mesaUrlForTableId(mesaTabTableIdRef.current),
      );
      mesaTabTableIdRef.current = null;
    }
  }, [
    enabled,
    mode,
    sessionSlice.showTapeteSignal,
    sessionSlice.currentTableId,
    sessionSlice.postResultHoldActive,
    sessionSlice.lobbyCooldownActive,
  ]);

  useEffect(() => {
    if (sessionSlice.lobbyCooldownActive && sessionSlice.showTapeteSignal) return;
    if (sessionSlice.lobbyWait) return;
    if (!sessionSlice.showTapeteSignal) {
      if (sessionSlice.sessionMode !== "prepare") {
        clearExtensionLastEmitKey();
        lastFingerprintRef.current = null;
        prevShowTapeteRef.current = false;
        prevEmitKeyRef.current = null;
      }
      return;
    }
    const rising = !prevShowTapeteRef.current;
    prevShowTapeteRef.current = true;
    const emitKey = `${sessionSlice.betAttemptKey ?? sessionSlice.signalId ?? ""}|${sessionSlice.currentRecovery ?? 0}`;
    if (rising || prevEmitKeyRef.current !== emitKey) {
      clearExtensionLastEmitKey();
      lastFingerprintRef.current = null;
      prevEmitKeyRef.current = emitKey;
    }
  }, [sessionSlice.showTapeteSignal, sessionSlice.signalId, sessionSlice.betAttemptKey, sessionSlice.currentRecovery]);

  useEffect(() => {
    if (!enabled) return;
    if (sessionSlice.postResultHoldActive) return;
    if (sessionSlice.lobbyCooldownActive && sessionSlice.showTapeteSignal) return;
    if (fingerprint === lastFingerprintRef.current) return;

    const actions = planRotatingRoomClickBotActions(sessionSlice);
    const clicks = actions.filter((a) => a.kind === "click");

    if (mode === "extension" && clicks.length === 0) {
      lastFingerprintRef.current = fingerprint;
      return;
    }

    const emitKey = sessionSlice.lobbyWait
      ? "lobby-wait-poker"
      : `${sessionSlice.betAttemptKey ?? sessionSlice.signalId ?? fingerprint}|r${sessionSlice.currentRecovery ?? 0}`;
    if (mode === "extension" && clicks.length > 0) {
      if (readExtensionLastEmitKey() === emitKey) return;
      writeExtensionLastEmitKey(emitKey);
    }

    lastFingerprintRef.current = fingerprint;

    const at = new Date().toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const entryId = ++logIdRef.current;

    if (mode === "extension") {
      const context = buildRotatingRoomExtensionContext(sessionSlice, mesaEmbedUrl, automationBalance);
      emitRotatingRoomExtensionBridge({ fingerprint: emitKey, actions, context });
      setLog((prev) =>
        [{ id: entryId, at, fingerprint: emitKey, actions, extensionAck: false }, ...prev].slice(0, MAX_LOG),
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
          const result = executeRotatingRoomClickBotTarget(action.target, root ?? document);
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
        setLog((prev) => [{ id: entryId, at, fingerprint, actions }, ...prev].slice(0, MAX_LOG));
      }
    } else {
      setLog((prev) => [{ id: entryId, at, fingerprint, actions }, ...prev].slice(0, MAX_LOG));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    mode,
    fingerprint,
    mesaEmbedUrl,
    sessionSlice.currentRecovery,
    sessionSlice.signalId,
    sessionSlice.lobbyWait,
    sessionSlice.showTapeteSignal,
    sessionSlice.postResultHoldActive,
  ]);

  useEffect(() => {
    if (!enabled || mode !== "extension") return;

    const onAck = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
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
      const betFailed = executed?.some(
        (e) =>
          (e.target === "factor-1" || e.target === "factor-2") &&
          !e.ok &&
          !e.detail.includes("ignorado"),
      );
      if (betFailed) clearExtensionLastEmitKey();
    };

    window.addEventListener("message", onAck);
    return () => window.removeEventListener("message", onAck);
  }, [enabled, mode]);

  useEffect(() => {
    if (!enabled) {
      lastFingerprintRef.current = null;
      return;
    }
    if (mode === "extension") {
      clearExtensionLastEmitKey();
      lastFingerprintRef.current = null;
    }
  }, [enabled, mode]);

  const clearLog = () => setLog([]);

  return { log, clearLog, currentPlan: planRotatingRoomClickBotActions(sessionSlice) };
}
