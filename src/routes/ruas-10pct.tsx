import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";

import { RouletteAppTabs } from "@/components/roulette-app-tabs";
import { RouletteHistoryGrid11x3Section } from "@/components/roulette-history-grid-11x3";
import { RouletteStatCard } from "@/components/roulette-stat-card";
import { StreetStrategyTable } from "@/components/street-strategy-table";
import { useStreetStrategySpinOutcomeFlash } from "@/hooks/useStreetStrategySpinOutcomeFlash";
import { useStrategyIndicationActivatedSound } from "@/hooks/useStrategyIndicationActivatedSound";
import {
  ROULETTE_LIVE_TABLE_HISTORY_EVENT,
  liveTableHistoryStorageKey,
  liveTableSpinTimesStorageKey,
  readLiveTableHistory,
  type RouletteLiveTableHistoryDetail,
} from "@/lib/roulette/historyStorage";
import { lobbyTableDisplayName, markLobbyReturnToDefaultStrategy, resolveLobbyCardTableIds, resolveRuas9ViewTableId } from "@/lib/roulette/lobbyTables";
import { ROULETTE_LIVE_TABLE_CONFIG_EVENT, getLiveRouletteTableIds } from "@/lib/roulette/liveTableConfig";
import { ruas9PctAutoCriticalBundle } from "@/lib/roulette/ruas9PctAutoCritical";
import {
  RUAS_9_GRID_BASE_INDEX_11,
  RUAS_9_GRID_COMPARE_INDEX_1,
  RUAS_9_GRID_COMPARE_INDEX_12,
} from "@/lib/roulette/ruas9PctNeighborGatilho";
import {
  currentConsecutiveStreaksFromPlacarOutcomes,
  simulateStreetStrategy,
  streetStrategyPlacarEvolutionSeries,
  streetStrategyPlacarOutcomesByExcludedStreets,
} from "@/lib/roulette/streetStrategy";

export const Route = createFileRoute("/ruas-10pct")({
  validateSearch: (search: Record<string, unknown>): { mesa?: number } => {
    const raw = search.mesa;
    if (raw === undefined || raw === null || raw === "") return {};
    const n = typeof raw === "number" ? raw : Number(String(raw));
    if (!Number.isInteger(n) || n <= 0) return {};
    return { mesa: n };
  },
  head: () => ({
    meta: [
      { title: "Ruas 9% - Roleta" },
      {
        name: "description",
        content: "Ruas 9% — tapete e placar em tempo real.",
      },
    ],
  }),
  component: Ruas10pctStrategyPage,
});

function Ruas10pctStrategyPage() {
  const { mesa } = Route.useSearch();
  const viewTableId = resolveRuas9ViewTableId(mesa);

  useEffect(() => {
    markLobbyReturnToDefaultStrategy();
  }, []);

  const [history, setHistory] = useState<number[]>(() => readLiveTableHistory(viewTableId));
  const [tableIds, setTableIds] = useState<number[]>(() =>
    [...resolveLobbyCardTableIds(getLiveRouletteTableIds())],
  );
  const [allHistories, setAllHistories] = useState<Record<number, number[]>>(() => {
    const ids = resolveLobbyCardTableIds(getLiveRouletteTableIds());
    const map: Record<number, number[]> = {};
    for (const id of ids) map[id] = readLiveTableHistory(id);
    return map;
  });

  useEffect(() => {
    const syncTables = () => {
      const ids = [...resolveLobbyCardTableIds(getLiveRouletteTableIds())];
      setTableIds(ids);
      setAllHistories((prev) => {
        const next: Record<number, number[]> = {};
        for (const id of ids) next[id] = prev[id] ?? readLiveTableHistory(id);
        return next;
      });
    };
    syncTables();
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, syncTables);
    return () => window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, syncTables);
  }, []);

  useEffect(() => {
    const sync = () => {
      setHistory(readLiveTableHistory(viewTableId));
      setAllHistories((prev) => ({ ...prev, [viewTableId]: readLiveTableHistory(viewTableId) }));
    };
    sync();
    const onLive = (ev: Event) => {
      const d = (ev as CustomEvent<RouletteLiveTableHistoryDetail>).detail;
      if (!d?.tableId) return;
      setAllHistories((prev) => {
        if (!tableIds.includes(d.tableId)) return prev;
        return { ...prev, [d.tableId]: readLiveTableHistory(d.tableId) };
      });
      if (d.tableId === viewTableId) sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null) {
        sync();
        return;
      }
      for (const id of tableIds) {
        if (e.key === liveTableHistoryStorageKey(id) || e.key === liveTableSpinTimesStorageKey(id)) {
          setAllHistories((prev) => ({ ...prev, [id]: readLiveTableHistory(id) }));
          if (id === viewTableId) setHistory(readLiveTableHistory(viewTableId));
          break;
        }
      }
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
  }, [viewTableId, tableIds]);

  /** Placar acumulado — sem reset por hora civil. */
  const historyPlacar = history;

  const ruas9Auto = useMemo(
    () => ruas9PctAutoCriticalBundle(historyPlacar, `ruas9-mesa-${viewTableId}`),
    [historyPlacar, viewTableId],
  );

  const analysis = useMemo(
    () => simulateStreetStrategy(historyPlacar, ruas9Auto.opts),
    [historyPlacar, ruas9Auto.opts],
  );
  const outcomes = useMemo(
    () => streetStrategyPlacarOutcomesByExcludedStreets(historyPlacar, ruas9Auto.opts),
    [historyPlacar, ruas9Auto.opts],
  );
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
  const evo = useMemo(
    () => streetStrategyPlacarEvolutionSeries(historyPlacar, ruas9Auto.opts),
    [historyPlacar, ruas9Auto.opts],
  );
  const rodadasEvo = useMemo(
    () =>
      historyPlacar.length > 0
        ? Array.from({ length: historyPlacar.length }, (_, i) => i + 1)
        : undefined,
    [historyPlacar],
  );

  const { active } = analysis;

  const mesaLabel = lobbyTableDisplayName(viewTableId);

  useStrategyIndicationActivatedSound(active);

  const spinFlash = useStreetStrategySpinOutcomeFlash(historyPlacar, ruas9Auto.opts, viewTableId);

  const ruas9GridCellRole = useCallback((index: number) => {
    if (index === RUAS_9_GRID_COMPARE_INDEX_1 || index === RUAS_9_GRID_COMPARE_INDEX_12) {
      return "compare" as const;
    }
    if (index === RUAS_9_GRID_BASE_INDEX_11) return "base" as const;
    return undefined;
  }, []);

  const historySectionClass =
    "mx-auto mt-4 max-w-4xl rounded-2xl border border-cyan-950/25 bg-[#0d1524]/90 px-2 py-2.5 shadow-lg shadow-black/20 sm:px-3";

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="mb-3 rounded-xl border border-cyan-950/25 bg-[#060a14]/90 px-3 py-2 text-center text-sm text-slate-400">
          Ruas 9% · <span className="font-semibold text-white">{mesaLabel}</span>
          <span className="text-slate-500"> · mesa {viewTableId}</span>
          <span className="mt-1 block text-[11px] text-cyan-200/90">
            Gatilho: pos. 1 e 12 (metade) · base pos. 11 —{" "}
            <span className="font-semibold text-cyan-50">{ruas9Auto.criticalLabel}</span>
          </span>
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
              tone="amber"
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
          rows={2}
          colorMode="height"
          cellRoleForIndex={ruas9GridCellRole}
          sectionClassName={historySectionClass}
        />

        <section className="mt-6">
          <div className="mx-auto flex max-w-3xl min-w-0 flex-col rounded-3xl border border-slate-800/80 bg-[#0d1524] p-4 shadow-xl sm:p-5">
            <div
              className={`relative w-full overflow-x-auto rounded-xl border-4 bg-[#060a14]/80 p-1.5 shadow-lg backdrop-blur-sm ${
                active
                  ? "border-cyan-400/65 street-indication-pulse-cyan"
                  : "border-cyan-950/45"
              }`}
            >
              <StreetStrategyTable
                active={active}
                awaitSpinHistory={historyPlacar}
                resultPinNumber={spinFlash?.resultNumber ?? null}
                spinFlash={spinFlash}
              />
              {!active ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[#080d18]/88 px-4">
                  <p className="text-center text-base font-semibold tracking-wide text-cyan-100/90 sm:text-lg">
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
