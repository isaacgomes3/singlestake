import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { RouletteAppTabs } from "@/components/roulette-app-tabs";
import { RouletteHistoryGrid11x3Section } from "@/components/roulette-history-grid-11x3";
import { RouletteStatCard } from "@/components/roulette-stat-card";
import { StreetStrategyTable } from "@/components/street-strategy-table";
import { useStreetStrategySpinOutcomeFlash } from "@/hooks/useStreetStrategySpinOutcomeFlash";
import { useStrategyIndicationActivatedSound } from "@/hooks/useStrategyIndicationActivatedSound";
import {
  ROULETTE_ESPELHO_SPIN_TIMES_KEY,
  ROULETTE_HISTORY_CHANGED_EVENT,
  ROULETTE_MIRROR_HISTORY_SCOPE,
  historyChangeAffectsScope,
  persistRouletteHistory,
  readRouletteHistory,
  rouletteHistoryStorageKey,
  type RouletteHistoryChangedDetail,
} from "@/lib/roulette/historyStorage";
import {
  currentConsecutiveStreaksFromPlacarOutcomes,
  simulateStreetStrategy,
  streetStrategyPlacarEvolutionSeries,
  streetStrategyPlacarOutcomesByExcludedStreets,
} from "@/lib/roulette/streetStrategy";

/** Mesma lógica que Ruas 9% (gatilho de altura nas pos. 11./22. da grelha + continuação + semiciclo oposto); aqui excluem-se duas ruas (score de frieza com cor/par dominantes). */
const RUAS_20_PCT_OPTS = {
  exclusionStreetCount: 2 as const,
  mirrorHeightIndication: true,
  placarBetStreetsAsDraws: true,
};

export const Route = createFileRoute("/ruas")({
  head: () => ({
    meta: [
      { title: "Ruas 20% - Roleta" },
      {
        name: "description",
        content: "Ruas 20% — tapete e placar em tempo real.",
      },
    ],
  }),
  component: RuasStrategyPage,
});

function RuasStrategyPage() {
  const [history, setHistory] = useState<number[]>(() =>
    readRouletteHistory(ROULETTE_MIRROR_HISTORY_SCOPE),
  );
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const scope = ROULETTE_MIRROR_HISTORY_SCOPE;
    const sync = () => setHistory(readRouletteHistory(scope));
    sync();
    const onCustom = (ev: Event) => {
      const d = (ev as CustomEvent<RouletteHistoryChangedDetail>).detail;
      if (historyChangeAffectsScope(d, scope)) sync();
    };
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === rouletteHistoryStorageKey(scope) ||
        e.key === ROULETTE_ESPELHO_SPIN_TIMES_KEY ||
        e.key === null
      )
        sync();
    };
    window.addEventListener(ROULETTE_HISTORY_CHANGED_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(ROULETTE_HISTORY_CHANGED_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function appendManualRound() {
    const n = Number(inputValue);
    if (!Number.isInteger(n) || n < 0 || n > 36) return;
    const prev = readRouletteHistory(ROULETTE_MIRROR_HISTORY_SCOPE);
    const next = [n, ...prev];
    persistRouletteHistory(next, ROULETTE_MIRROR_HISTORY_SCOPE);
    setHistory(next);
    setInputValue("");
  }

  function clearHistory() {
    persistRouletteHistory([], ROULETTE_MIRROR_HISTORY_SCOPE);
    setHistory([]);
  }

  /** Placar acumulado — sem reset por hora civil. */
  const historyPlacar = history;

  const analysis = useMemo(() => simulateStreetStrategy(historyPlacar, RUAS_20_PCT_OPTS), [historyPlacar]);
  const outcomes = useMemo(
    () => streetStrategyPlacarOutcomesByExcludedStreets(historyPlacar, RUAS_20_PCT_OPTS),
    [historyPlacar],
  );
  const placar = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const x of outcomes) {
      if (x === "W") wins += 1;
      else if (x === "L") losses += 1;
      else draws += 1;
    }
    return { wins, losses, draws };
  }, [outcomes]);
  const streaks = useMemo(() => currentConsecutiveStreaksFromPlacarOutcomes(outcomes), [outcomes]);
  const totalAvaliacoes = placar.wins + placar.losses;
  const aproveitamento = totalAvaliacoes ? (placar.wins / totalAvaliacoes) * 100 : 0;
  const evo = useMemo(
    () => streetStrategyPlacarEvolutionSeries(historyPlacar, RUAS_20_PCT_OPTS),
    [historyPlacar],
  );
  const rodadasEvo = useMemo(
    () =>
      historyPlacar.length > 0
        ? Array.from({ length: historyPlacar.length }, (_, i) => i + 1)
        : undefined,
    [historyPlacar],
  );

  const { active } = analysis;

  useStrategyIndicationActivatedSound(active);

  const spinFlash = useStreetStrategySpinOutcomeFlash(historyPlacar, RUAS_20_PCT_OPTS);

  return (
    <div className="min-h-screen bg-slate-950/75 text-slate-100 backdrop-blur-[2px]">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <RouletteAppTabs>
          <div className="flex w-[7.25rem] shrink-0 sm:w-32">
            <input
              type="number"
              min={0}
              max={36}
              step={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") appendManualRound();
              }}
              placeholder="Ex: 17"
              aria-label="Numero sorteado de 0 a 36"
              className="h-9 w-full min-w-0 rounded-lg border border-violet-500/40 bg-slate-950 px-2.5 text-sm font-semibold text-slate-100 outline-none transition focus:border-violet-300"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={appendManualRound}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Adicionar rodada
            </button>
            <button
              type="button"
              onClick={clearHistory}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-rose-500 px-3 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              Limpar Historico
            </button>
          </div>
        </RouletteAppTabs>

        <section className="mt-6 overflow-x-auto pb-2 [scrollbar-width:thin] md:overflow-visible md:pb-0">
          <div className="mx-auto grid min-w-[52rem] max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 md:min-w-0 md:grid-cols-4 lg:grid-cols-7 md:w-full">
            <RouletteStatCard label="Rodadas" value={historyPlacar.length} evolution={rodadasEvo} />
            <RouletteStatCard
              label="Vitorias"
              value={placar.wins}
              tone="green"
              evolution={evo?.cumulativeWins}
            />
            <RouletteStatCard
              label="Empate"
              value={placar.draws}
              tone="default"
            />
            <RouletteStatCard
              label="Derrotas"
              value={placar.losses}
              tone="red"
              evolution={evo?.cumulativeLosses}
            />
            <RouletteStatCard
              label="Aproveitamento"
              value={`${aproveitamento.toFixed(1)}%`}
              tone="amber"
              evolution={evo?.aproveitamentoPct}
            />
            <RouletteStatCard
              label="Vitorias seguidas"
              value={streaks.consecutiveWins}
              tone="green"
              evolution={evo?.streakCurrent}
            />
            <RouletteStatCard
              label="MAX. VIT. SEGUIDAS"
              value={streaks.maxConsecutiveWins}
              tone="green"
              evolution={evo?.streakMax}
            />
          </div>
        </section>

        <RouletteHistoryGrid11x3Section history={history} />

        <section className="mt-6">
          <div className="mx-auto flex max-w-3xl min-w-0 flex-col rounded-3xl border border-violet-500/35 bg-slate-900/80 p-4 sm:p-5">
            <div
              className={`relative w-full overflow-x-auto rounded-xl border-4 bg-slate-950/95 p-1.5 shadow-lg backdrop-blur-sm ${
                active ? "border-violet-400/70 street-indication-pulse" : "border-violet-400/45"
              }`}
            >
              <StreetStrategyTable
                active={active}
                awaitSpinHistory={historyPlacar}
                resultPinNumber={spinFlash?.resultNumber ?? null}
                spinFlash={spinFlash}
              />
              {!active ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-950/80 px-4">
                  <p className="text-center text-base font-semibold tracking-wide text-violet-200 sm:text-lg">
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
