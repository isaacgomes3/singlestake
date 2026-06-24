import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { RouletteAppTabs } from "@/components/roulette-app-tabs";
import { RouletteHistoryGrid11x3Section } from "@/components/roulette-history-grid-11x3";
import { RouletteStatCard } from "@/components/roulette-stat-card";
import { Ruas25PctStrategyTable } from "@/components/ruas-25pct-strategy-table";
import { useRuas25PctSpinOutcomeFlash } from "@/hooks/useRuas25PctSpinOutcomeFlash";
import { useStrategyIndicationActivatedSound } from "@/hooks/useStrategyIndicationActivatedSound";
import {
  ROULETTE_LIVE_TABLE_HISTORY_EVENT,
  liveTableHistoryStorageKey,
  liveTableSpinTimesStorageKey,
  readLiveTableHistory,
  type RouletteLiveTableHistoryDetail,
} from "@/lib/roulette/historyStorage";
import { lobbyTableDisplayName, markLobbyReturnToDefaultStrategy, resolveRuas9ViewTableId } from "@/lib/roulette/lobbyTables";
import { ROULETTE_LIVE_TABLE_CONFIG_EVENT } from "@/lib/roulette/liveTableConfig";
import {
  RUAS_25_PCT_STRATEGY_DISPLAY_NAME,
  ruas25PctActiveFromSnapshot,
  ruas25PctPlacarEvolutionSeries,
  ruas25PctPlacarOutcomes,
} from "@/lib/roulette/ruas25PctStrategy";
import { currentConsecutiveStreaksFromPlacarOutcomes } from "@/lib/roulette/streetStrategy";

export const Route = createFileRoute("/ruas-25pct")({
  validateSearch: (search: Record<string, unknown>): { mesa?: number } => {
    const raw = search.mesa;
    if (raw === undefined || raw === null || raw === "") return {};
    const n = typeof raw === "number" ? raw : Number(String(raw));
    if (!Number.isInteger(n) || n <= 0) return {};
    return { mesa: n };
  },
  head: () => ({
    meta: [
      { title: `${RUAS_25_PCT_STRATEGY_DISPLAY_NAME} - Roleta` },
      {
        name: "description",
        content: `${RUAS_25_PCT_STRATEGY_DISPLAY_NAME} — tapete e placar em tempo real.`,
      },
    ],
  }),
  component: Ruas25pctPage,
});

function Ruas25pctPage() {
  const { mesa } = Route.useSearch();
  const viewTableId = resolveRuas9ViewTableId(mesa);

  useEffect(() => {
    markLobbyReturnToDefaultStrategy();
  }, []);

  const [history, setHistory] = useState<number[]>(() => readLiveTableHistory(viewTableId));

  useEffect(() => {
    const sync = () => setHistory(readLiveTableHistory(viewTableId));
    sync();
    const onLive = (ev: Event) => {
      const d = (ev as CustomEvent<RouletteLiveTableHistoryDetail>).detail;
      if (d?.tableId === viewTableId) sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === liveTableHistoryStorageKey(viewTableId) ||
        e.key === liveTableSpinTimesStorageKey(viewTableId) ||
        e.key === null
      )
        sync();
    };
    const onConfig = () => sync();
    window.addEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
    window.addEventListener("storage", onStorage);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, onConfig);
    return () => {
      window.removeEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLive);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, onConfig);
    };
  }, [viewTableId]);

  /** Placar acumulado — sem reset por hora civil. */
  const historyPlacar = history;

  const outcomes = useMemo(() => ruas25PctPlacarOutcomes(historyPlacar), [historyPlacar]);
  const placar = useMemo(() => {
    let wins = 0;
    let losses = 0;
    for (const x of outcomes) {
      if (x === "W") wins += 1;
      else if (x === "L") losses += 1;
    }
    return { wins, losses };
  }, [outcomes]);
  const streaks = useMemo(() => currentConsecutiveStreaksFromPlacarOutcomes(outcomes), [outcomes]);
  const totalAvaliacoes = placar.wins + placar.losses;
  const aproveitamento = totalAvaliacoes ? (placar.wins / totalAvaliacoes) * 100 : 0;
  const evo = useMemo(() => ruas25PctPlacarEvolutionSeries(historyPlacar), [historyPlacar]);
  const rodadasEvo = useMemo(
    () =>
      historyPlacar.length > 0
        ? Array.from({ length: historyPlacar.length }, (_, i) => i + 1)
        : undefined,
    [historyPlacar],
  );

  const active = useMemo(() => ruas25PctActiveFromSnapshot(historyPlacar), [historyPlacar]);

  useStrategyIndicationActivatedSound(active);

  const mesaLabel = lobbyTableDisplayName(viewTableId);
  const spinFlash = useRuas25PctSpinOutcomeFlash(historyPlacar, viewTableId);

  const historySectionClass =
    "mx-auto mt-4 max-w-4xl rounded-2xl border border-emerald-950/25 bg-[#0d1524]/90 px-2 py-2.5 shadow-lg shadow-black/20 sm:px-3";

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="mb-3 rounded-xl border border-emerald-950/25 bg-[#060a14]/90 px-3 py-2 text-center text-sm text-slate-400">
          {RUAS_25_PCT_STRATEGY_DISPLAY_NAME} · <span className="font-semibold text-white">{mesaLabel}</span>
          <span className="text-slate-500"> · mesa {viewTableId}</span>
        </p>
        <RouletteAppTabs />

        <section className="mt-6 overflow-x-auto pb-2 [scrollbar-width:thin] md:overflow-visible md:pb-0">
          <div className="mx-auto grid min-w-[44rem] max-w-6xl grid-cols-6 gap-3 md:min-w-0 md:w-full">
            <RouletteStatCard
              label="Rodadas"
              value={historyPlacar.length}
              evolution={rodadasEvo}
              variant="lobby"
            />
            <RouletteStatCard
              label="Vitorias"
              value={placar.wins}
              tone="green"
              evolution={evo?.cumulativeWins}
              variant="lobby"
            />
            <RouletteStatCard
              label="Derrotas"
              value={placar.losses}
              tone="red"
              evolution={evo?.cumulativeLosses}
              variant="lobby"
            />
            <RouletteStatCard
              label="Aproveitamento"
              value={`${aproveitamento.toFixed(1)}%`}
              tone="green"
              evolution={evo?.aproveitamentoPct}
              variant="lobby"
            />
            <RouletteStatCard
              label="Vitorias seguidas"
              value={streaks.consecutiveWins}
              tone="green"
              evolution={evo?.streakCurrent}
              variant="lobby"
            />
            <RouletteStatCard
              label="MAX. VIT. SEGUIDAS"
              value={streaks.maxConsecutiveWins}
              tone="green"
              evolution={evo?.streakMax}
              variant="lobby"
            />
          </div>
        </section>

        <RouletteHistoryGrid11x3Section
          history={history}
          rows={1}
          sectionClassName={historySectionClass}
        />

        <section className="mt-6">
          <div className="mx-auto flex max-w-3xl min-w-0 flex-col rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 shadow-xl sm:p-5">
            <div
              className={`relative w-full overflow-x-auto rounded-xl border-4 bg-[#060a14]/80 p-1.5 shadow-lg backdrop-blur-sm ${
                active
                  ? "border-emerald-400/65 street-indication-pulse-cyan"
                  : "border-emerald-950/45"
              }`}
            >
              <Ruas25PctStrategyTable
                active={active}
                awaitSpinHistory={historyPlacar}
                resultPinNumber={spinFlash?.resultNumber ?? null}
                spinFlash={spinFlash}
              />
              {!active ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[#080d18]/88 px-4">
                  <p className="text-center text-base font-semibold tracking-wide text-emerald-100/90 sm:text-lg">
                    Aguardando Nova Entrada...
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
