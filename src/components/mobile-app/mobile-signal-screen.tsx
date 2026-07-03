import { Link } from "@tanstack/react-router";
import { BarChart3, ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { MobileEntryHistoryList } from "@/components/mobile-app/mobile-entry-history";
import { useMobileTableEntryHistory } from "@/hooks/useMobileTableEntryHistory";
import { doisFatoresFactorButtonClass, doisFatoresFactorLabel, type DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import {
  formatMobileLastNumbersChain,
  mobileSignalConfidenceFromBucketGap,
  mobileSpinStripClass,
} from "@/lib/roulette/mobileSignalUi";
import type { MobileTableSessionView } from "@/lib/roulette/mobileTableSessionView";
import {
  mobileRotatingRoomOperatorUrl,
  openMobileRotatingRoomTable,
} from "@/lib/roulette/rotatingRoomTableOpen";
import type { StrategyGlobalKind } from "@/lib/roulette/strategyGlobalTypes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  strategyTitle: string;
  strategySubtitle: string;
  strategyKind: StrategyGlobalKind;
  tableId: number;
  sessionView: MobileTableSessionView;
  history: readonly number[];
  maxRecovery: number;
  /** Volta ao picker de estratégias da mesa (modo mobile). */
  backMesaId?: string;
  /** Volta ao lobby (`/`) quando aberto a partir do cartão do lobby. */
  backToLobby?: boolean;
  onReset?: () => void;
};

function FactorChip({ factor, large }: { factor: DoisFatoresFactor; large?: boolean }) {
  return (
    <span
      translate="no"
      className={cn(
        "notranslate inline-flex items-center justify-center rounded-xl border font-black uppercase tracking-wide",
        large ? "px-4 py-3 text-sm" : "px-3 py-1.5 text-xs",
        doisFatoresFactorButtonClass(factor),
      )}
    >
      {doisFatoresFactorLabel(factor)}
    </span>
  );
}

function GaleRow({ current, maxRecovery }: { current: number; maxRecovery: number }) {
  const levels = Array.from({ length: Math.min(maxRecovery, 5) }, (_, i) => i + 1);
  return (
    <div className="mt-3 rounded-xl bg-neutral-800/60 p-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Zona de gale — opcional
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {levels.map((g) => {
          const active = current === g;
          return (
            <div
              key={g}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-bold leading-tight",
                active
                  ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                  : "border-neutral-700/80 bg-neutral-900/50 text-neutral-500",
              )}
            >
              {active ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                  ✓
                </span>
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-neutral-600" />
              )}
              Gale {g}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  dotClass,
  timer,
  children,
}: {
  label: string;
  dotClass: string;
  timer?: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-neutral-800/90 bg-neutral-900/90 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", dotClass)} aria-hidden />
          <span className="text-sm font-bold text-neutral-200">{label}</span>
        </div>
        {timer ? <span className="text-xs tabular-nums text-neutral-500">{timer}</span> : null}
      </div>
      {children}
    </article>
  );
}

function StatLine({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-800/80 py-2 last:border-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", valueClass ?? "text-neutral-200")}>{value}</span>
    </div>
  );
}

function BackLink({ backMesaId, backToLobby }: { backMesaId?: string; backToLobby?: boolean }) {
  if (backMesaId) {
    return (
      <Link
        to="/mobile/roleta/$mesaId"
        params={{ mesaId: backMesaId }}
        className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-300"
        aria-label="Voltar"
      >
        <ChevronLeft className="h-6 w-6" />
      </Link>
    );
  }
  return (
    <Link
      to={backToLobby ? "/" : "/mobile"}
      className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-300"
      aria-label="Voltar"
    >
      <ChevronLeft className="h-6 w-6" />
    </Link>
  );
}

export function MobileSignalScreen({
  strategyTitle,
  strategySubtitle,
  strategyKind,
  tableId,
  sessionView,
  history,
  maxRecovery,
  backMesaId,
  backToLobby = false,
  onReset,
}: Props) {
  const single = sessionView.singleFactorMode;
  const isPrepare =
    !single &&
    !sessionView.showTapeteSignal &&
    !("postResultHoldActive" in sessionView && sessionView.postResultHoldActive === true) &&
    (sessionView.sessionMode === "prepare" || sessionView.prepareTableId != null);
  const isActive =
    sessionView.showTapeteSignal &&
    sessionView.activeCrossing != null &&
    sessionView.currentTableId != null;
  const isWaiting = !isPrepare && !isActive && sessionView.roundFlash == null;

  const focusTableId = isActive
    ? sessionView.currentTableId
    : isPrepare
      ? sessionView.prepareTableId
      : tableId;

  const focusLabel = lobbyTableDisplayName(focusTableId);
  const mesaUrl = mobileRotatingRoomOperatorUrl(focusTableId);
  const canOpenLive = (isPrepare || isActive) && mesaUrl != null;
  const recentStrip = history.slice(0, 12);
  const recentChain = history;

  const crossing = sessionView.activeCrossing;
  const factor1 = crossing?.factor1;
  const factor2 = crossing?.factor2;
  const bucketGap = sessionView.alertBucketGap;
  const confidence = mobileSignalConfidenceFromBucketGap(bucketGap);

  const entryHistory = useMobileTableEntryHistory(
    tableId,
    strategyKind,
    sessionView,
    history,
    single,
  );

  const lastWinNumber =
    sessionView.roundFlash?.resultNumber ??
    (recentChain[0] != null ? String(recentChain[0]) : "—");

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [isActive]);
  const timerLabel = useMemo(() => {
    void tick;
    if (!isActive) return undefined;
    const s = Math.floor((Date.now() / 1000) % 120);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [isActive, tick]);

  const openMesa = () => {
    if (!isPrepare && !isActive) return;
    if (openMobileRotatingRoomTable(focusTableId)) return;
    toast.message("Link do casino não configurado", {
      description: "No Lobby, abra a mesa e cole o URL do operador (após login).",
    });
  };

  const factorsLabel =
    factor1 && factor2
      ? `${doisFatoresFactorLabel(factor1).replace(/\s+/g, "").slice(0, 8)} • ${doisFatoresFactorLabel(factor2).replace(/\s+/g, "").slice(0, 8)}`
      : factor1
        ? doisFatoresFactorLabel(factor1)
        : "—";

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col bg-black">
      <header className="sticky top-0 z-40 border-b border-neutral-900 bg-black/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <BackLink backMesaId={backMesaId} backToLobby={backToLobby} />
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-bold text-white">{strategyTitle}</p>
            <p className="truncate text-xs text-neutral-500">{focusLabel ?? strategySubtitle}</p>
          </div>
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="shrink-0 rounded-lg border border-neutral-800 px-2 py-1 text-[10px] font-semibold text-neutral-400 hover:text-amber-300"
            >
              Zerar
            </button>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center text-neutral-600">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        {canOpenLive && mesaUrl ? (
          <a
            href={mesaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3.5 text-sm font-black uppercase tracking-wide text-black shadow-lg shadow-amber-500/20"
          >
            <BarChart3 className="h-4 w-4" aria-hidden />
            Jogar ao vivo
          </a>
        ) : (
          <button
            type="button"
            onClick={openMesa}
            disabled={!isPrepare && !isActive}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3.5 text-sm font-black uppercase tracking-wide text-black shadow-lg shadow-amber-500/20",
              !isPrepare && !isActive && "opacity-40",
            )}
          >
            <BarChart3 className="h-4 w-4" aria-hidden />
            Jogar ao vivo
          </button>
        )}

        {recentStrip.length > 0 ? (
          <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none]">
            <div className="flex gap-1.5 px-1">
              {recentStrip.map((n, i) => (
                <div
                  key={`${n}-${i}`}
                  className={cn(
                    "flex h-9 min-w-[2.25rem] shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums",
                    mobileSpinStripClass(n),
                    i === 0 && "ring-1 ring-amber-400/60",
                  )}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isPrepare ? (
          <InfoCard label="Posicione-se" dotClass="bg-amber-400">
            <p className="text-center text-lg font-bold text-amber-100">{focusLabel}</p>
            <p className="mt-2 text-center text-xs text-neutral-500">Abra a mesa antes da entrada</p>
          </InfoCard>
        ) : null}

        {isActive ? (
          <InfoCard label="Sinal activo" dotClass="bg-emerald-400" timer={timerLabel}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
              {single ? "Factor" : "Colunas"}
            </p>
            <p className="mb-3 text-lg font-bold text-emerald-300">{factorsLabel}</p>
            <StatLine label="Últimos números" value={formatMobileLastNumbersChain(recentChain)} />
            <StatLine label="Proteção" value={String(sessionView.currentRecovery)} />
            <StatLine label="Confiança" value={confidence} />
            <StatLine label="Número vencedor" value={String(lastWinNumber)} valueClass="text-emerald-400" />
            <GaleRow
              current={Math.min(maxRecovery, sessionView.currentRecovery + 1)}
              maxRecovery={maxRecovery}
            />
            <div className={cn("mt-4 flex gap-2", single && "justify-center")}>
              {factor1 ? <FactorChip factor={factor1} large /> : null}
              {!single && factor2 ? <FactorChip factor={factor2} large /> : null}
            </div>
          </InfoCard>
        ) : null}

        <MobileEntryHistoryList
          items={entryHistory}
          singleFactor={single}
          maxRecovery={maxRecovery}
        />

        {isWaiting ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-600" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-600 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-600 [animation-delay:300ms]" />
            </div>
            <p className="mt-4 text-sm font-medium text-neutral-500">Aguardando próxima entrada</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
