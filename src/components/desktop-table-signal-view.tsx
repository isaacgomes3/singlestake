import { Link } from "@tanstack/react-router";
import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";
import { ChevronLeft, ExternalLink, MapPin } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { MobileEntryHistoryList } from "@/components/mobile-app/mobile-entry-history";
import { RouletteAppTabs } from "@/components/roulette-app-tabs";
import { RouletteStatCard } from "@/components/roulette-stat-card";
import { useMobileTableEntryHistory } from "@/hooks/useMobileTableEntryHistory";
import {
  doisFatoresFactorButtonClass,
  doisFatoresFactorLabel,
  type DoisFatoresFactor,
} from "@/lib/roulette/doisFatoresStrategy";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import {
  formatMobileLastNumbersChain,
  mobileSignalConfidenceFromBucketGap,
  mobileSpinStripClass,
} from "@/lib/roulette/mobileSignalUi";
import type { MobileTableSessionView } from "@/lib/roulette/mobileTableSessionView";
import { rotatingRoomSessionAproveitamentoPct } from "@/lib/roulette/rotatingRoomStrategy";
import {
  mobileRotatingRoomOperatorUrl,
  openMobileRotatingRoomTable,
} from "@/lib/roulette/rotatingRoomTableOpen";
import type { StrategyGlobalKind } from "@/lib/roulette/strategyGlobalTypes";
import { cn } from "@/lib/utils";

type SessionStats = { wins: number; losses: number };

type Props = {
  strategyTitle: string;
  tableId: number;
  strategyKind: StrategyGlobalKind;
  sessionView: MobileTableSessionView;
  history: readonly number[];
  maxRecovery: number;
  sessionStats: SessionStats;
  onReset: () => void;
  alertLabel?: string | null;
};

const PANEL_SHELL =
  "rounded-2xl border border-cyan-950/30 bg-[#0d1524]/95 shadow-lg shadow-black/25";

function FactorChip({ factor, large }: { factor: DoisFatoresFactor; large?: boolean }) {
  return (
    <span
      translate="no"
      className={cn(
        "notranslate inline-flex items-center justify-center rounded-xl border font-black uppercase tracking-wide",
        large ? "px-5 py-3 text-sm" : "px-3 py-1.5 text-xs",
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
    <div className="mt-4 rounded-xl border border-cyan-950/25 bg-[#060a14]/80 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Zona de gale — opcional
      </p>
      <div className="grid grid-cols-5 gap-2">
        {levels.map((g) => {
          const active = current === g;
          return (
            <div
              key={g}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-xs font-bold",
                active
                  ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                  : "border-slate-700/80 bg-slate-900/50 text-slate-500",
              )}
            >
              {active ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                  ✓
                </span>
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-slate-600" />
              )}
              Gale {g}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatLine({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-cyan-950/20 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", valueClass ?? "text-slate-100")}>{value}</span>
    </div>
  );
}

function SignalPanel({
  label,
  dotClass,
  timer,
  borderClass,
  children,
}: {
  label: string;
  dotClass: string;
  timer?: string;
  borderClass?: string;
  children: ReactNode;
}) {
  return (
    <article className={cn(PANEL_SHELL, "p-5 sm:p-6", borderClass)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", dotClass)} aria-hidden />
          <span className="text-sm font-bold text-slate-100">{label}</span>
        </div>
        {timer ? <span className="text-xs tabular-nums text-slate-500">{timer}</span> : null}
      </div>
      {children}
    </article>
  );
}

export function DesktopTableSignalView({
  strategyTitle,
  tableId,
  strategyKind,
  sessionView,
  history,
  maxRecovery,
  sessionStats,
  onReset,
  alertLabel,
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
    ? sessionView.currentTableId!
    : isPrepare
      ? sessionView.prepareTableId!
      : tableId;

  const mesaLabel = lobbyTableDisplayName(focusTableId);
  const mesaUrl = mobileRotatingRoomOperatorUrl(focusTableId);
  const canOpenLive = (isPrepare || isActive) && mesaUrl != null;
  const recentStrip = history.slice(0, 16);
  const crossing = sessionView.activeCrossing;
  const factor1 = crossing?.factor1;
  const factor2 = crossing?.factor2;
  const confidence = mobileSignalConfidenceFromBucketGap(sessionView.alertBucketGap);

  const entryHistory = useMobileTableEntryHistory(
    tableId,
    strategyKind,
    sessionView,
    history,
    single,
  );

  const aproveitamento = rotatingRoomSessionAproveitamentoPct(sessionStats);
  const total = sessionStats.wins + sessionStats.losses;

  const lastWinNumber =
    sessionView.roundFlash?.resultNumber ??
    (history[0] != null ? String(history[0]) : "—");

  const factorsLabel =
    factor1 && factor2
      ? `${doisFatoresFactorLabel(factor1)} · ${doisFatoresFactorLabel(factor2)}`
      : factor1
        ? doisFatoresFactorLabel(factor1)
        : "—";

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

  const flash = sessionView.roundFlash;

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-cyan-950/30 bg-[#080d18]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to={BACK_OFFICE_PATHS.salaRotativa}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-100"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Voltar ao back office
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-bold text-white sm:text-lg">
              {strategyTitle} · {mesaLabel}
            </h1>
            <p className="truncate text-xs text-slate-500">mesa {tableId}</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-200"
          >
            Zerar placar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <RouletteAppTabs />

        {alertLabel && !sessionView.showTapeteSignal ? (
          <p className="mt-4 text-center text-xs text-cyan-200/90">
            <span className="font-semibold text-cyan-50">{alertLabel}</span>
          </p>
        ) : null}

        <section className="mt-5 overflow-x-auto pb-2 [scrollbar-width:thin] md:overflow-visible md:pb-0">
          <div className="mx-auto grid min-w-[44rem] max-w-6xl grid-cols-2 gap-3 sm:grid-cols-5 md:min-w-0 md:w-full">
            <RouletteStatCard label="Vitórias" value={sessionStats.wins} tone="green" variant="lobby" />
            <RouletteStatCard label="Derrotas" value={sessionStats.losses} tone="red" variant="lobby" />
            <RouletteStatCard
              label="Recuperação"
              value={sessionView.currentRecovery}
              hint={`máx. ${maxRecovery}`}
              tone={sessionView.currentRecovery > 0 ? "amber" : undefined}
              variant="lobby"
            />
            <RouletteStatCard
              label="Aproveitamento"
              value={`${aproveitamento.toFixed(1)}%`}
              tone="green"
              variant="lobby"
            />
            <RouletteStatCard label="Entradas" value={total} variant="lobby" />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            {canOpenLive && mesaUrl ? (
              <a
                href={mesaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-cyan-300"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Jogar ao vivo
              </a>
            ) : (
              <button
                type="button"
                onClick={openMesa}
                disabled={!isPrepare && !isActive}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-cyan-300",
                  !isPrepare && !isActive && "cursor-not-allowed opacity-40",
                )}
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Jogar ao vivo
              </button>
            )}

            {recentStrip.length > 0 ? (
              <div className={cn(PANEL_SHELL, "overflow-x-auto px-3 py-3 [scrollbar-width:thin]")}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Últimos giros
                </p>
                <div className="flex gap-1.5">
                  {recentStrip.map((n, i) => (
                    <div
                      key={`${n}-${i}`}
                      className={cn(
                        "flex h-9 min-w-[2.25rem] shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums",
                        mobileSpinStripClass(n),
                        i === 0 && "ring-2 ring-cyan-400/50",
                      )}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {flash ? (
              <div
                className={cn(
                  PANEL_SHELL,
                  "flex flex-col items-center px-6 py-8 text-center",
                  flash.won ? "border-emerald-500/40" : "border-rose-500/40",
                )}
              >
                <p
                  className={cn(
                    "text-2xl font-black sm:text-3xl",
                    flash.won ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {flash.won ? "Vitória" : "Derrota"}
                  {single ? " (1 factor)" : " (2 factores)"}
                </p>
                <p className="mt-2 flex items-center gap-1 text-lg font-bold tabular-nums text-white">
                  <MapPin className="h-5 w-5 text-cyan-300" aria-hidden />
                  Nº {flash.resultNumber}
                </p>
              </div>
            ) : null}

            {isPrepare ? (
              <SignalPanel label="Posicione-se na mesa" dotClass="bg-amber-400" borderClass="border-amber-500/30">
                <p className="text-center text-xl font-bold text-amber-100">{mesaLabel}</p>
                <p className="mt-2 text-center text-sm text-slate-500">Abra a mesa antes da próxima entrada</p>
              </SignalPanel>
            ) : null}

            {isActive ? (
              <SignalPanel
                label="Sinal activo"
                dotClass="bg-emerald-400"
                timer={timerLabel}
                borderClass="border-emerald-500/40 street-indication-pulse-cyan"
              >
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {single ? "Factor" : "Colunas"}
                </p>
                <p className="mb-4 text-xl font-bold text-emerald-300">{factorsLabel}</p>
                <StatLine label="Últimos números" value={formatMobileLastNumbersChain(history)} />
                <StatLine label="Proteção" value={String(sessionView.currentRecovery)} />
                <StatLine label="Confiança" value={confidence} />
                <StatLine label="Número vencedor" value={String(lastWinNumber)} valueClass="text-emerald-400" />
                <GaleRow
                  current={Math.min(maxRecovery, sessionView.currentRecovery + 1)}
                  maxRecovery={maxRecovery}
                />
                <div className={cn("mt-5 flex flex-wrap gap-2", single && "justify-center")}>
                  {factor1 ? <FactorChip factor={factor1} large /> : null}
                  {!single && factor2 ? <FactorChip factor={factor2} large /> : null}
                </div>
              </SignalPanel>
            ) : null}

            {isWaiting ? (
              <div className={cn(PANEL_SHELL, "flex flex-col items-center px-6 py-12 text-center")}>
                <div className="flex gap-1.5" aria-hidden>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500/60" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500/60 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500/60 [animation-delay:300ms]" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-400">Aguardando próxima entrada</p>
              </div>
            ) : null}
          </div>

          <aside className="min-w-0 lg:sticky lg:top-[4.5rem]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Histórico de entradas</h2>
              {entryHistory.length > 0 ? (
                <span className="text-[10px] tabular-nums text-slate-600">{entryHistory.length} recentes</span>
              ) : null}
            </div>
            {entryHistory.length > 0 ? (
              <MobileEntryHistoryList
                items={entryHistory}
                singleFactor={single}
                maxRecovery={maxRecovery}
                variant="desktop"
              />
            ) : (
              <div className={cn(PANEL_SHELL, "px-4 py-8 text-center text-sm text-slate-500")}>
                As entradas liquidadas aparecem aqui.
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
