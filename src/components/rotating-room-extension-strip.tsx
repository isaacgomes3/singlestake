import { Puzzle } from "lucide-react";
import { useEffect, useState } from "react";

import { useRotatingRoomExtensionAckLog } from "@/hooks/useRotatingRoomExtensionAckLog";
import { useRotatingRoomExtensionPresent } from "@/hooks/useRotatingRoomExtensionPresent";
import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomUmFatorSession } from "@/hooks/useRotatingRoomUmFatorSession";
import {
  planRotatingRoomClickBotActions,
  type RotatingRoomClickBotSessionSlice,
} from "@/lib/roulette/rotatingRoomClickBotLearning";
import {
  casinoEmbedPathLabel,
  casinoEmbedProviderFromUrl,
  casinoEmbedProviderLabel,
} from "@/lib/roulette/casinoEmbedProviderHint";
import { getCasinoEmbedUrlForTable } from "@/lib/roulette/casinoEmbedConfig";
import { stakeForRecovery, formatStakeBrl } from "@/lib/back-office/rouletteAutomationSim";
import {
  readEffectiveUmFatorMaxRecovery,
  readRotatingRoomExtensionStats,
  ROTATING_ROOM_EXTENSION_ENABLED_KEY,
  ROTATING_ROOM_EXTENSION_PREFS_EVENT,
  ROTATING_ROOM_EXTENSION_REAL_MODE_KEY,
  readRotatingRoomExtensionEnabled,
  readRotatingRoomExtensionRealMode,
  writeRotatingRoomExtensionEnabled,
  writeRotatingRoomExtensionMaxRecovery,
  writeRotatingRoomExtensionRealMode,
} from "@/lib/roulette/rotatingRoomExtensionPrefs";
import {
  doisFatoresFactorKindLabel,
  doisFatoresFactorLabel,
  type DoisFatoresFactor,
} from "@/lib/roulette/doisFatoresStrategy";
import { umFatorToTapeteActive } from "@/lib/roulette/umFatorStrategy";
import { pragmaticExteriorBetKeyFromFactor } from "@/lib/roulette/pragmaticExteriorBetMap";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { rotatingRoomLobbyFocusTableId } from "@/lib/roulette/rotatingRoomLobbySignal";
import {
  buildRotatingRoomMesaCatalog,
} from "@/lib/roulette/rotatingRoomExtensionBridge";
import { resolveRotatingRoomTableIds } from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds } from "@/lib/roulette/liveTableConfig";
import { cn } from "@/lib/utils";

function factorKindBadgeClass(kind: DoisFatoresFactor["kind"]): string {
  switch (kind) {
    case "paridade":
      return "border-violet-500/45 bg-violet-950/50 text-violet-200";
    case "cor":
      return "border-rose-500/45 bg-rose-950/50 text-rose-200";
    case "altura":
      return "border-amber-500/45 bg-amber-950/50 text-amber-200";
  }
}

function ExtensionBetTypeBadge({ factor }: { factor: DoisFatoresFactor }) {
  const kindLabel = doisFatoresFactorKindLabel(factor);
  const valueLabel = doisFatoresFactorLabel(factor);
  const betKey = pragmaticExteriorBetKeyFromFactor(factor);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(
          "rounded border px-1 py-px text-[8px] font-bold uppercase tracking-wide",
          factorKindBadgeClass(factor.kind),
        )}
      >
        {kindLabel}
      </span>
      <span className="text-[8px] font-semibold text-slate-300">{valueLabel}</span>
      <span className="font-mono text-[8px] text-slate-500">{betKey}</span>
    </span>
  );
}

type Props = {
  session: RotatingRoomCrossingSession | RotatingRoomUmFatorSession;
  /** URL do operador (iframe ou guardada) — não usa fallback Pragmatic do código. */
  mesaEmbedUrl?: string | null;
  className?: string;
};

function sessionToExtensionSlice(
  session: RotatingRoomCrossingSession | RotatingRoomUmFatorSession,
): RotatingRoomClickBotSessionSlice {
  const singleFactorMode = "singleFactorMode" in session && session.singleFactorMode === true;
  const umActive = "umActive" in session ? session.umActive : null;
  let activeCrossing = session.activeCrossing;
  if (!activeCrossing && singleFactorMode && umActive) {
    activeCrossing = umFatorToTapeteActive(umActive);
  }
  const signalId =
    singleFactorMode && umActive
      ? `${session.currentTableId}:${umActive.resultNumber}:${umActive.alertFactor.kind}:${session.currentRecovery}`
      : null;

  return {
    sessionMode: session.sessionMode,
    showTapeteSignal: session.showTapeteSignal,
    prepareTableId: session.prepareTableId,
    currentTableId: session.currentTableId,
    activeCrossing,
    singleFactorMode,
    signalId,
    currentRecovery: session.currentRecovery,
  };
}

export function RotatingRoomExtensionStrip({ session, mesaEmbedUrl: mesaEmbedUrlProp, className }: Props) {
  const [enabled, setEnabled] = useState(readRotatingRoomExtensionEnabled);
  const [realMode, setRealMode] = useState(readRotatingRoomExtensionRealMode);
  const { present: extensionPresent, prefs: extensionPongPrefs } = useRotatingRoomExtensionPresent();
  const [extensionPrefs, setExtensionPrefs] = useState(() => ({
    maxRecovery: readEffectiveUmFatorMaxRecovery(),
    ...readRotatingRoomExtensionStats(),
  }));
  const maxRecovery = extensionPrefs.maxRecovery;
  const placarWins = session.sessionStats.wins;
  const placarLosses = session.sessionStats.losses;

  const focusTableId = rotatingRoomLobbyFocusTableId(session) ?? session.currentTableId;
  const mesaCatalog = buildRotatingRoomMesaCatalog();
  const rotatingRoomTotal = resolveRotatingRoomTableIds(getLiveRouletteTableIds()).length;
  const mesaEmbedUrl =
    mesaEmbedUrlProp ??
    (focusTableId != null
      ? mesaCatalog.find((e) => e.tableId === focusTableId)?.url ??
        getCasinoEmbedUrlForTable(focusTableId)
      : null);
  const mesaProvider = casinoEmbedProviderFromUrl(mesaEmbedUrl);
  const mesaPath = casinoEmbedPathLabel(mesaEmbedUrl);

  const sessionSlice = sessionToExtensionSlice(session);
  const currentPlan = planRotatingRoomClickBotActions(sessionSlice);
  const log = useRotatingRoomExtensionAckLog(enabled);

  useEffect(() => {
    if (!readRotatingRoomExtensionEnabled()) {
      writeRotatingRoomExtensionEnabled(true);
      setEnabled(true);
    }
  }, []);

  const lastRow = log[0];
  const lastExec =
    lastRow?.executed?.find((e) => e.target === "factor-1") ??
    lastRow?.executed?.find((e) => e.target === "prepare-open") ??
    lastRow?.executed?.[0];

  const pendingClick = currentPlan.some((a) => a.kind === "click");

  const pageOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

  useEffect(() => {
    const sync = () => {
      setEnabled(readRotatingRoomExtensionEnabled());
      setRealMode(readRotatingRoomExtensionRealMode());
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === ROTATING_ROOM_EXTENSION_ENABLED_KEY ||
        event.key === ROTATING_ROOM_EXTENSION_REAL_MODE_KEY
      ) {
        sync();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROTATING_ROOM_EXTENSION_PREFS_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!extensionPongPrefs) return;
    if (extensionPongPrefs.maxRecovery != null) {
      writeRotatingRoomExtensionMaxRecovery(extensionPongPrefs.maxRecovery);
    }
    setExtensionPrefs({
      maxRecovery: extensionPongPrefs.maxRecovery ?? readEffectiveUmFatorMaxRecovery(),
      wins: extensionPongPrefs.wins ?? 0,
      losses: extensionPongPrefs.losses ?? 0,
    });
  }, [extensionPongPrefs]);

  useEffect(() => {
    const onPrefs = () => {
      setExtensionPrefs({
        maxRecovery: readEffectiveUmFatorMaxRecovery(),
        ...readRotatingRoomExtensionStats(),
      });
    };
    window.addEventListener("singlestake-extension-prefs", onPrefs);
    return () => window.removeEventListener("singlestake-extension-prefs", onPrefs);
  }, []);

  const toggleReal = () => {
    setRealMode((prev) => {
      const next = !prev;
      if (next && !window.confirm("Activar entradas REAIS na mesa (martingale)? Confirma.")) {
        return prev;
      }
      writeRotatingRoomExtensionRealMode(next);
      return next;
    });
  };

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      writeRotatingRoomExtensionEnabled(next);
      return next;
    });
  };

  const signalLabel =
    session.showTapeteSignal && session.activeCrossing
      ? doisFatoresFactorLabel(session.activeCrossing.factor1)
      : null;
  const signalFactor =
    session.showTapeteSignal && session.activeCrossing ? session.activeCrossing.factor1 : null;
  const signalFactor2 =
    session.showTapeteSignal &&
    session.activeCrossing &&
    !("singleFactorMode" in session && session.singleFactorMode)
      ? session.activeCrossing.factor2
      : null;
  const tableLabel =
    session.currentTableId != null ? lobbyTableDisplayName(session.currentTableId) : null;

  const [lastDispatchedBet, setLastDispatchedBet] = useState<{
    factor1: DoisFatoresFactor;
    factor2?: DoisFatoresFactor;
    tableLabel: string | null;
  } | null>(null);

  useEffect(() => {
    if (!lastRow) return;
    const sentClick = lastRow.actions.some((a) => a.kind === "click");
    if (!sentClick || !session.activeCrossing) return;
    setLastDispatchedBet({
      factor1: session.activeCrossing.factor1,
      factor2:
        "singleFactorMode" in session && session.singleFactorMode
          ? undefined
          : session.activeCrossing.factor2,
      tableLabel,
    });
  }, [lastRow?.id, session.activeCrossing, session.singleFactorMode, tableLabel]);

  const signalsLinked = enabled && extensionPresent;

  const bridgeStatusHint =
    !extensionPresent
      ? `Sem extensão em ${pageOrigin}. Abra esta página no Google Chrome (não no browser do Cursor), recarregue a extensão em chrome://extensions e F5.`
      : !enabled
        ? "Extensão detectada — clique Activo para enviar sinais."
        : realMode
          ? `Alertas JOGANDO → extensão em modo REAL.${maxRecovery === 0 ? " Gales=0: sem martingale." : ""}`
          : `Sinais Um Fator enviados à extensão (demo).${maxRecovery === 0 ? " Gales=0: sem martingale." : ""}`;

  return (
    <div
      className={cn(
        "relative z-[3] rounded-xl border border-cyan-400/45 bg-slate-900/95 px-2.5 py-2 shadow-md ring-1 ring-cyan-500/20",
        signalsLinked && "border-emerald-500/40 ring-emerald-500/25",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Puzzle className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-wide text-cyan-200/90">
          Extensão · sinais
        </span>

        {extensionPresent ? (
          <span className="rounded-md border border-emerald-500/40 bg-emerald-950/40 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-300">
            {signalsLinked ? "Ligado" : "Instalada"}
          </span>
        ) : (
          <span className="rounded-md border border-amber-500/40 bg-amber-950/40 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-300">
            Sem extensão
          </span>
        )}

        {extensionPresent ? (
          <span className="rounded-md border border-slate-600/60 bg-slate-900/80 px-1.5 py-0.5 text-[8px] font-semibold text-slate-300">
            {placarWins}V · {placarLosses}D · {maxRecovery}g
          </span>
        ) : null}

        <button
          type="button"
          onClick={toggleReal}
          disabled={!enabled}
          className={cn(
            "rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            !enabled && "opacity-40",
            realMode
              ? "border-red-500/50 bg-red-950/50 text-red-300"
              : "border-slate-600 bg-slate-900/80 text-slate-400",
          )}
        >
          {realMode ? "Real" : "Demo"}
        </button>

        <button
          type="button"
          onClick={toggle}
          className={cn(
            "ml-auto rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            enabled
              ? "border-emerald-500/50 bg-emerald-950/50 text-emerald-300"
              : "border-slate-600 bg-slate-900/80 text-slate-400",
          )}
        >
          {enabled ? "Activo" : "Parado"}
        </button>
      </div>

      {enabled ? (
        <p
          className={cn(
            "mt-1.5 text-[9px] leading-snug",
            extensionPresent ? "text-emerald-400/95" : "text-amber-300/90",
          )}
        >
          {bridgeStatusHint}
        </p>
      ) : (
        <p className="mt-1.5 text-[9px] text-slate-500">
          {extensionPresent
            ? "Extensão instalada — clique Activo para enviar sinais à mesa."
            : "Activa para a estratégia enviar paridade, cor ou altura à mesa via extensão Chrome."}
        </p>
      )}

      {mesaEmbedUrl ? (
        <p className="mt-1 text-[9px] text-slate-400">
          Operador:{" "}
          <span className="font-semibold text-cyan-200/90">
            {casinoEmbedProviderLabel(mesaProvider)}
          </span>
          {mesaPath ? (
            <>
              {" "}
              · <span className="font-mono text-[8px] text-slate-500">{mesaPath}</span>
            </>
          ) : null}
        </p>
      ) : focusTableId != null ? (
        <p className="mt-1 text-[9px] text-amber-300/90">
          Sem URL do operador para {lobbyTableDisplayName(focusTableId)} — configure em{" "}
          <span className="font-semibold">Ferramentas da mesa</span>.
        </p>
      ) : null}

      {enabled && mesaCatalog.length > 0 ? (
        <p className="mt-1 text-[9px] text-slate-400">
          Mesas com link:{" "}
          <span className="font-semibold text-cyan-200/90">
            {mesaCatalog.length}/{rotatingRoomTotal}
          </span>
          {" · "}
          {mesaCatalog.map((e) => e.label).join(", ")}
        </p>
      ) : enabled && rotatingRoomTotal > 0 ? (
        <p className="mt-1 text-[9px] text-amber-300/90">
          Nenhuma mesa da sala rotativa tem URL guardada — configure em Ferramentas da mesa.
        </p>
      ) : null}

      {session.showTapeteSignal && signalLabel && tableLabel && signalFactor ? (
        <div className="mt-1 space-y-1">
          <p className="text-[10px] font-semibold text-emerald-200/95">
            Sinal: {tableLabel} · {signalLabel}
            {session.currentRecovery > 0
              ? ` · gale ${session.currentRecovery}/${maxRecovery}`
              : ""}
            {` · ${formatStakeBrl(stakeForRecovery(session.currentRecovery))}`}
            {signalsLinked ? (realMode ? " → REAL" : " → demo") : ""}
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400">
            <span className="font-semibold text-slate-300">Aposta:</span>
            <ExtensionBetTypeBadge factor={signalFactor} />
            {signalFactor2 ? (
              <>
                <span className="text-slate-600">+</span>
                <ExtensionBetTypeBadge factor={signalFactor2} />
              </>
            ) : null}
          </p>
        </div>
      ) : enabled && pendingClick && !session.showTapeteSignal ? (
        <p className="mt-1 text-[9px] text-cyan-200/90">Próximo: {currentPlan.find((a) => a.kind === "click")?.label}</p>
      ) : null}

      {enabled && lastRow && lastRow.extensionAck && lastExec ? (
        <div className="mt-1 space-y-0.5">
          {!signalFactor && lastDispatchedBet ? (
            <p className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400">
              <span className="font-semibold text-slate-300">Último clique:</span>
              {lastDispatchedBet.tableLabel ? (
                <span>{lastDispatchedBet.tableLabel} ·</span>
              ) : null}
              <ExtensionBetTypeBadge factor={lastDispatchedBet.factor1} />
              {lastDispatchedBet.factor2 ? (
                <>
                  <span className="text-slate-600">+</span>
                  <ExtensionBetTypeBadge factor={lastDispatchedBet.factor2} />
                </>
              ) : null}
            </p>
          ) : null}
          <p
            className={cn(
              "text-[9px] leading-snug",
              lastExec.ok ? "text-emerald-300" : "text-amber-300",
            )}
          >
            Mesa: {lastExec.ok ? "✓" : "⚠"} {lastExec.detail}
          </p>
        </div>
      ) : null}

      {enabled && lastRow && !lastRow.extensionAck ? (
        <p className="mt-1 text-[9px] text-slate-500">
          A aguardar confirmação da extensão…
        </p>
      ) : null}

      {enabled && lastRow && lastRow.extensionAck && !lastExec && signalsLinked ? (
        <p className="mt-1 text-[9px] text-amber-300">
          Extensão respondeu sem clique — abra a mesa num separador e calibre paridade, cor e altura.
        </p>
      ) : null}
    </div>
  );
}
