import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { BackOfficeWorkspaceNav } from "@/components/back-office/back-office-workspace-nav";
import { FootballBlitzHistoryGrid11x2Section } from "@/components/football-blitz-history-grid-11x2";
import { RouletteStatCard } from "@/components/roulette-stat-card";
import { SuperTrunfoStrategyTable } from "@/components/super-trunfo-strategy-table";
import { useStrategyIndicationActivatedSound } from "@/hooks/useStrategyIndicationActivatedSound";
import { useSuperTrunfoPlacar } from "@/hooks/useSuperTrunfoPlacar";
import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";
import type { FootballBlitzTableConfig } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import {
  DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT,
  readFootballBlitzHistory,
  type FootballBlitzRoundStored,
} from "@/lib/pragmatic/dgaFootballBlitzHistory";
import { evaluateSuperTrunfoAlert, superTrunfoActiveFromAlert } from "@/lib/pragmatic/superTrunfoAlert";
import { cn } from "@/lib/utils";

type FootballBlitzStrategyPageProps = {
  config: FootballBlitzTableConfig;
};

export function FootballBlitzStrategyPage({ config }: FootballBlitzStrategyPageProps) {
  const { tableKey, displayName, variant } = config;
  const [history, setHistory] = useState<FootballBlitzRoundStored[]>(() =>
    typeof window !== "undefined" ? readFootballBlitzHistory(tableKey) : [],
  );

  useEffect(() => {
    const sync = (ev: Event) => {
      const detail = (ev as CustomEvent<{ tableKey?: number }>).detail;
      if (detail?.tableKey != null && detail.tableKey !== tableKey) return;
      setHistory(readFootballBlitzHistory(tableKey));
    };
    sync(new Event("init"));
    window.addEventListener(DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT, sync);
    return () => window.removeEventListener(DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT, sync);
  }, [tableKey]);

  const alert = useMemo(() => evaluateSuperTrunfoAlert(history, variant), [history, variant]);
  const active = useMemo(() => superTrunfoActiveFromAlert(alert), [alert]);

  const { wins, losses, aproveitamentoPct, evo, rodadas } =
    useSuperTrunfoPlacar(tableKey, history, variant);
  const totalAvaliacoes = wins + losses;
  const rodadasEvo = useMemo(
    () => (rodadas > 0 ? Array.from({ length: rodadas }, (_, i) => i + 1) : undefined),
    [rodadas],
  );

  useStrategyIndicationActivatedSound(active);

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="mb-3 rounded-xl border border-emerald-950/30 bg-[#060a14]/90 px-3 py-2 text-center text-sm text-slate-400">
          {displayName}
          <span className="text-slate-500"> · mesa {tableKey}</span>
        </p>

        <BackOfficeWorkspaceNav />

        <section className="mt-6 overflow-x-auto pb-2 [scrollbar-width:thin] md:overflow-visible md:pb-0">
          <div className="mx-auto grid min-w-[28rem] max-w-6xl grid-cols-4 gap-3 md:min-w-0 md:w-full">
            <RouletteStatCard
              label="Rondas"
              value={rodadas}
              evolution={rodadasEvo}
              variant="lobby"
            />
            <RouletteStatCard
              label="Vitórias"
              value={wins}
              tone="green"
              evolution={evo?.cumulativeWins}
              variant="lobby"
            />
            <RouletteStatCard
              label="Derrotas"
              value={losses}
              tone="red"
              evolution={evo?.cumulativeLosses}
              variant="lobby"
            />
            <RouletteStatCard
              label="Aproveitamento"
              value={totalAvaliacoes > 0 ? `${aproveitamentoPct.toFixed(1)}%` : "—"}
              tone="green"
              evolution={evo?.aproveitamentoPct}
              variant="lobby"
            />
          </div>
        </section>

        <FootballBlitzHistoryGrid11x2Section
          history={history}
          variant={variant}
          tableKey={tableKey}
        />

        <section className="mt-6">
          <div className="mx-auto flex max-w-5xl min-w-0 flex-col rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 shadow-xl sm:p-5">
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-xl border-4 bg-[#0a2618]/90 p-1.5 shadow-lg backdrop-blur-sm",
                active
                  ? "border-amber-300/70 street-indication-pulse"
                  : "border-emerald-950/45",
              )}
            >
              <SuperTrunfoStrategyTable active={active} variant={variant} />
              {!active ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[#0a2618]/88 px-4">
                  <p className="max-w-md text-center text-base font-semibold tracking-wide text-emerald-100/90 sm:text-lg">
                    Aguardando nova entrada…
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-slate-500">
          <Link
            to={BACK_OFFICE_PATHS.home}
            className="font-semibold text-cyan-400 hover:text-cyan-300"
          >
            ← Voltar ao back office
          </Link>
        </p>
      </main>
    </div>
  );
}
