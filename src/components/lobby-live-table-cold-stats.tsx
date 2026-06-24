import { useMemo } from "react";

import {
  coldDoubleStreets,
  coldNumbers,
  coldStreets,
  coldestTwoByParameterCrossGrouped,
} from "@/lib/roulette/liveTableColdStats";
import { colorOf } from "@/lib/roulette/streetPairTrigger";

function numTileClass(n: number, variant: "default" | "compact" = "default"): string {
  const c = colorOf(n);
  const base =
    variant === "compact"
      ? "inline-flex h-7 min-w-[1.4rem] shrink-0 items-center justify-center rounded px-0.5 text-[10px] font-bold tabular-nums text-white shadow-inner sm:min-w-[1.5rem] sm:text-[11px]"
      : "inline-flex h-8 min-w-[1.85rem] shrink-0 items-center justify-center rounded-md px-1 text-xs font-bold tabular-nums text-white shadow-inner sm:h-9 sm:min-w-[2.1rem] sm:text-sm";
  if (c === "Zero") return `${base} border border-emerald-400/50 bg-emerald-600`;
  if (c === "Vermelho") return `${base} border border-red-500/35 bg-red-600`;
  return `${base} border border-slate-600 bg-slate-950`;
}

type LobbyLiveRouletteColdBlockProps = {
  mesaTitle: string;
  tableId: number;
  historyNewestFirst: readonly number[];
};

/**
 * Painéis «frios» por mesa: ruas, números e duplas ruas (giros desde última ocorrência), alinhado ao histórico ao vivo newest-first.
 */
export function LobbyLiveRouletteColdBlock({
  mesaTitle,
  tableId,
  historyNewestFirst,
}: LobbyLiveRouletteColdBlockProps) {
  const streets = useMemo(() => coldStreets(historyNewestFirst, 4), [historyNewestFirst]);
  const nums = useMemo(() => coldNumbers(historyNewestFirst, 10), [historyNewestFirst]);
  const cross = useMemo(() => coldestTwoByParameterCrossGrouped(historyNewestFirst), [historyNewestFirst]);
  const doubles = useMemo(() => coldDoubleStreets(historyNewestFirst, 4), [historyNewestFirst]);

  const empty = historyNewestFirst.length === 0;

  return (
    <section
      className="rounded-2xl border border-slate-800/90 bg-[#0a101c]/95 p-4 shadow-lg sm:p-5"
      aria-labelledby={`mesa-cold-${tableId}-heading`}
    >
      <div className="border-b border-slate-800/80 pb-3">
        <h3 id={`mesa-cold-${tableId}-heading`} className="text-base font-bold tracking-tight text-white">
          {mesaTitle}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Mesa {tableId} · histórico ao vivo (mais recente primeiro)
        </p>
      </div>

      {empty ? (
        <p className="mt-6 text-center text-sm text-slate-500">Aguardando giros para calcular frieza…</p>
      ) : (
        <div className="mt-5 space-y-8">
          <div>
            <h4 className="text-sm font-bold text-white">Ruas</h4>
            <ul className="mt-4 space-y-3">
              {streets.map((row) => (
                <li
                  key={row.streetId}
                  className="flex flex-col gap-2 rounded-lg border border-slate-800/60 bg-slate-950/40 px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3"
                >
                  <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
                    {row.numbers.map((n) => (
                      <span key={n} className={numTileClass(n)}>
                        {n}
                      </span>
                    ))}
                  </div>
                  <span
                    className="text-center text-sm font-bold tabular-nums text-sky-400 sm:min-w-[2.5rem] sm:text-right"
                  >
                    {row.gap}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white">Números</h4>
            <div className="mt-4 flex flex-wrap justify-center gap-x-2 gap-y-4 sm:justify-start">
              {nums.map((row) => (
                <div key={row.n} className="flex flex-col items-center gap-1">
                  <span className={numTileClass(row.n)}>{row.n}</span>
                  <span className="text-xs font-semibold tabular-nums text-sky-400">{row.gap}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white">Cruzamentos — 2 mais frios</h4>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="min-w-0 rounded-xl border border-slate-800/70 bg-slate-950/30 p-2 sm:p-2.5">
                <h5 className="border-b border-slate-800/60 pb-1.5 text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
                  Cor e metade do tapete
                </h5>
                <ul className="mt-2 space-y-1.5">
                  {cross.corAltura.map((row) => (
                    <li
                      key={row.category}
                      className="rounded-md border border-slate-800/50 bg-slate-950/50 px-1.5 py-1.5"
                    >
                      <p className="mb-1 line-clamp-2 text-[10px] font-medium leading-snug text-slate-400">
                        {row.category}
                      </p>
                      <div className="flex justify-center gap-1.5">
                        {row.items.map(({ n, gap }) => (
                          <div key={n} className="flex flex-col items-center gap-0.5">
                            <span className={numTileClass(n, "compact")}>{n}</span>
                            <span className="text-[10px] font-semibold tabular-nums text-sky-400">{gap}</span>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-800/70 bg-slate-950/30 p-2 sm:p-2.5">
                <h5 className="border-b border-slate-800/60 pb-1.5 text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
                  Cor e paridade
                </h5>
                <ul className="mt-2 space-y-1.5">
                  {cross.corParidade.map((row) => (
                    <li
                      key={row.category}
                      className="rounded-md border border-slate-800/50 bg-slate-950/50 px-1.5 py-1.5"
                    >
                      <p className="mb-1 line-clamp-2 text-[10px] font-medium leading-snug text-slate-400">
                        {row.category}
                      </p>
                      <div className="flex justify-center gap-1.5">
                        {row.items.map(({ n, gap }) => (
                          <div key={n} className="flex flex-col items-center gap-0.5">
                            <span className={numTileClass(n, "compact")}>{n}</span>
                            <span className="text-[10px] font-semibold tabular-nums text-sky-400">{gap}</span>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-800/70 bg-slate-950/30 p-2 sm:p-2.5">
                <h5 className="border-b border-slate-800/60 pb-1.5 text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
                  Metade e paridade
                </h5>
                <ul className="mt-2 space-y-1.5">
                  {cross.alturaParidade.map((row) => (
                    <li
                      key={row.category}
                      className="rounded-md border border-slate-800/50 bg-slate-950/50 px-1.5 py-1.5"
                    >
                      <p className="mb-1 line-clamp-2 text-[10px] font-medium leading-snug text-slate-400">
                        {row.category}
                      </p>
                      <div className="flex justify-center gap-1.5">
                        {row.items.map(({ n, gap }) => (
                          <div key={n} className="flex flex-col items-center gap-0.5">
                            <span className={numTileClass(n, "compact")}>{n}</span>
                            <span className="text-[10px] font-semibold tabular-nums text-sky-400">{gap}</span>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white">Duplas ruas</h4>
            <ul className="mt-4 space-y-3">
              {doubles.map((row) => (
                <li
                  key={row.firstStreetId}
                  className="flex flex-col gap-2 rounded-lg border border-slate-800/60 bg-slate-950/40 px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3"
                >
                  <div className="flex flex-wrap justify-center gap-1 sm:justify-start">
                    {row.numbers.map((n) => (
                      <span key={`${row.firstStreetId}-${n}`} className={numTileClass(n)}>
                        {n}
                      </span>
                    ))}
                  </div>
                  <span className="text-center text-sm font-bold tabular-nums text-sky-400 sm:min-w-[2.5rem] sm:text-right">
                    {row.gap}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
