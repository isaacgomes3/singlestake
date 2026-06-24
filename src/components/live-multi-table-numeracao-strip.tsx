import { useEffect, useState } from "react";

import {
  ROULETTE_HISTORY_CHANGED_EVENT,
  ROULETTE_LIVE_TABLE_HISTORY_EVENT,
  readLiveTableHistory,
  type RouletteHistoryChangedDetail,
} from "@/lib/roulette/historyStorage";
import {
  getLiveRouletteTableIds,
  getPrimaryLiveTableId,
  ROULETTE_LIVE_TABLE_CONFIG_EVENT,
} from "@/lib/roulette/liveTableConfig";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function cellClass(n: number): string {
  if (n === 0) return "border border-emerald-500/40 bg-emerald-700/90 text-white";
  if (RED.has(n)) return "border border-red-500/30 bg-red-600/85 text-white";
  return "border border-slate-600/50 bg-slate-800 text-slate-100";
}

const MAX_NUMS = 14;

/**
 * Uma coluna por mesa ao vivo: numeração em `roulette.liveTableHistory.{id}` (separada).
 * Só aparece com 2+ mesas no `ready` do SSE. A mesa principal alimenta também o espelho (primeiro ID).
 */
export function LiveMultiTableNumeracaoStrip() {
  const [, bump] = useState(0);
  const tableIds = [...getLiveRouletteTableIds()];
  const primary = getPrimaryLiveTableId();

  useEffect(() => {
    const onHist = (_ev: Event) => {
      const d = (_ev as CustomEvent<RouletteHistoryChangedDetail>).detail;
      if (d?.scope === "all" || d?.scope === "espelho") bump((x) => x + 1);
    };
    const onLt = (_ev: Event) => {
      bump((x) => x + 1);
    };
    window.addEventListener(ROULETTE_HISTORY_CHANGED_EVENT, onHist);
    window.addEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLt as EventListener);
    window.addEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, onLt);
    return () => {
      window.removeEventListener(ROULETTE_HISTORY_CHANGED_EVENT, onHist);
      window.removeEventListener(ROULETTE_LIVE_TABLE_HISTORY_EVENT, onLt as EventListener);
      window.removeEventListener(ROULETTE_LIVE_TABLE_CONFIG_EVENT, onLt);
    };
  }, []);

  if (tableIds.length < 2) return null;

  return (
    <div
      className="w-full rounded-xl border border-slate-800 bg-slate-950/90 px-2 py-2 sm:px-3"
      aria-label="Numeracao ao vivo por mesa"
    >
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
        Ao vivo por mesa
      </p>
      <div className="flex flex-wrap gap-3 sm:gap-4">
        {tableIds.map((tid) => {
          const nums = readLiveTableHistory(tid).slice(0, MAX_NUMS);
          const isPrimary = primary !== null && tid === primary;
          return (
            <div key={tid} className="min-w-0 flex-1 basis-[8rem] sm:basis-[10rem]">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-200">{lobbyTableDisplayName(tid)}</span>
                {isPrimary ? (
                  <span className="rounded bg-emerald-500/20 px-1 py-0 text-[9px] font-semibold uppercase text-emerald-300">
                    → espelho
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-0.5">
                {nums.length === 0 ? (
                  <span className="text-[10px] text-slate-600">—</span>
                ) : (
                  nums.map((n, i) => (
                    <span
                      key={`${tid}-${i}-${n}`}
                      className={`inline-flex h-6 min-w-[1.35rem] items-center justify-center rounded px-0.5 text-[11px] font-bold ${cellClass(n)}`}
                    >
                      {n}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
