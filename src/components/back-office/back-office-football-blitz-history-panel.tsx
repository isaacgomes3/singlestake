import { useEffect, useState } from "react";

import { FootballBlitzHistoryGrid11x2Section } from "@/components/football-blitz-history-grid-11x2";
import {
  FOOTBALL_BLITZ_SUPER_TRUNFO,
  FOOTBALL_BLITZ_TOP_CARD,
  type FootballBlitzTableConfig,
} from "@/lib/pragmatic/dgaFootballBlitzConstants";
import {
  DGA_FOOTBALL_BLITZ_HISTORY_CHANGED_EVENT,
  readFootballBlitzHistory,
  type FootballBlitzRoundStored,
} from "@/lib/pragmatic/dgaFootballBlitzHistory";

function useFootballBlitzTableHistory(tableKey: number) {
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

  return history;
}

function TableHistoryBlock({ config }: { config: FootballBlitzTableConfig }) {
  const history = useFootballBlitzTableHistory(config.tableKey);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-[#0d1524]/90 p-4 shadow-lg shadow-black/20">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-100">{config.displayName}</h3>
        <p className="text-xs text-slate-500">
          Mesa {config.tableKey} · {history.length} rondas
        </p>
      </div>
      <FootballBlitzHistoryGrid11x2Section
        history={history}
        variant={config.variant}
        tableKey={config.tableKey}
        sectionClassName="mx-auto max-w-4xl rounded-xl border border-slate-800/60 bg-[#080d18]/80 px-2 py-2.5 sm:px-3"
      />
    </section>
  );
}

/** Histórico DGA das mesas Top Card + Latino (mesmo catálogo das extensões Obs). */
export function BackOfficeFootballBlitzHistoryPanel() {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">
        Histórico ao vivo catalogado via DGA Pragmatic — mesmas mesas das extensões Obs
        cartas (Top Card e Latino).
      </p>
      <TableHistoryBlock config={FOOTBALL_BLITZ_TOP_CARD} />
      <TableHistoryBlock config={FOOTBALL_BLITZ_SUPER_TRUNFO} />
    </div>
  );
}
