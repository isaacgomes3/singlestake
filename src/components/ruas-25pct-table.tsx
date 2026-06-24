import { MapPin } from "lucide-react";

import { colorOf } from "@/lib/roulette/streetStrategy";
import type { Ruas25PctActive } from "@/lib/roulette/ruas25PctStrategy";

function numberCellClass(n: number) {
  const c = colorOf(n);
  if (c === "Zero") return "border-emerald-500/50 bg-emerald-600/85 text-white";
  if (c === "Vermelho") return "border-red-400/35 bg-red-600/80 text-white";
  return "border-slate-600 bg-slate-900 text-slate-100";
}

type Props = {
  active: Ruas25PctActive | null;
  resultPinNumber?: number | null;
};

/** Tapete Ruas 25% — realça os dois números mais frios do grupo mais ausente. */
export function Ruas25PctTable({ active, resultPinNumber = null }: Props) {
  const excluded = active ? new Set<number>(active.excludedNumbers) : null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-emerald-500/25 bg-slate-950/90 p-3 shadow-inner ring-1 ring-white/5">
      <div className="mx-auto min-w-[min(100%,560px)] max-w-[720px] text-[11px] sm:text-xs">
        <div className="flex items-stretch gap-0.5">
          <div
            className={`flex w-9 shrink-0 items-stretch sm:w-11 ${numberCellClass(0)} rounded-l-md border font-bold sm:text-sm`}
          >
            <div className="relative flex flex-1 items-center justify-center">
              0
              {resultPinNumber === 0 ? (
                <span className="pointer-events-none absolute left-1/2 top-0 z-[25] -translate-x-1/2 -translate-y-[28%]">
                  <MapPin
                    className="h-5 w-5 fill-amber-400 text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] sm:h-6 sm:w-6"
                    aria-hidden
                  />
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid flex-1 grid-cols-12 gap-0.5">
            {Array.from({ length: 12 }, (_, col) => {
              const streetId = col + 1;
              const top = 3 * (col + 1);
              const mid = 3 * col + 2;
              const bot = 3 * col + 1;

              return (
                <div key={streetId} className="relative flex min-w-0 flex-col gap-0.5">
                  {[top, mid, bot].map((n) => {
                    const isExcluded = excluded?.has(n) ?? false;
                    const isCovered = active && n >= 1 && n <= 36 && !isExcluded;
                    const base = numberCellClass(n);
                    const indicatedExcludedCls =
                      active && isExcluded
                        ? "border-2 border-dashed border-white/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                        : "";
                    const coverCls = isCovered
                      ? "shadow-[inset_0_0_0_999px_rgba(16,185,129,0.28)] ring-2 ring-emerald-400/60"
                      : "";
                    return (
                      <div
                        key={n}
                        className={`relative flex aspect-[5/4] min-h-[26px] items-center justify-center rounded-sm border font-bold tabular-nums sm:min-h-[30px] ${base} ${indicatedExcludedCls} ${coverCls}`}
                      >
                        {resultPinNumber === n ? (
                          <span className="pointer-events-none absolute left-1/2 top-0 z-[25] -translate-x-1/2 -translate-y-[28%]">
                            <MapPin
                              className="h-5 w-5 fill-amber-400 text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] sm:h-6 sm:w-6"
                              aria-hidden
                            />
                          </span>
                        ) : null}
                        {active && isExcluded ? (
                          <span
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-amber-300 bg-black/15 text-inherit shadow-[0_0_12px_rgba(251,191,36,0.5)] sm:h-8 sm:w-8 sm:border-[3.5px]"
                            aria-label={`Numero indicado para exclusao: ${n}`}
                          >
                            {n}
                          </span>
                        ) : (
                          n
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-0.5 grid grid-cols-12 gap-0.5 pl-[calc(2.25rem+0.125rem)] sm:pl-[calc(2.75rem+0.125rem)]">
          <div className="col-span-4 flex items-center justify-center rounded-sm border border-slate-700 bg-emerald-950/40 py-2 font-semibold text-emerald-100/90">
            1.ª 12
          </div>
          <div className="col-span-4 flex items-center justify-center rounded-sm border border-slate-700 bg-emerald-950/40 py-2 font-semibold text-emerald-100/90">
            2.ª 12
          </div>
          <div className="col-span-4 flex items-center justify-center rounded-sm border border-slate-700 bg-emerald-950/40 py-2 font-semibold text-emerald-100/90">
            3.ª 12
          </div>
        </div>

        <div className="mt-0.5 grid grid-cols-12 gap-0.5 pl-[calc(2.25rem+0.125rem)] sm:pl-[calc(2.75rem+0.125rem)]">
          {(
            [
              { key: "low", label: "Baixo\n1–18", span: 2 },
              { key: "even", label: "PARES", span: 2 },
              { key: "red", label: "◆", span: 2, red: true },
              { key: "black", label: "◆", span: 2, black: true },
              { key: "odd", label: "ÍMPARES", span: 2 },
              { key: "high", label: "Alto\n19–36", span: 2 },
            ] as const
          ).map((cell) => {
            const base =
              "relative flex min-h-[44px] items-center justify-center rounded-sm border py-2.5 font-semibold";
            let cls = "border-slate-700 bg-slate-900/90 text-slate-200";
            if ("red" in cell) cls = "border-red-500/40 bg-red-700/70 text-red-50";
            if ("black" in cell) cls = "border-slate-600 bg-slate-800 text-slate-100";

            return (
              <div
                key={cell.key}
                className={`${base} ${cls}`}
                style={{ gridColumn: `span ${cell.span} / span ${cell.span}` }}
              >
                <span
                  className={`${"red" in cell || "black" in cell ? "text-lg" : ""} ${cell.key === "low" || cell.key === "high" ? "whitespace-pre-line text-center leading-tight" : ""}`}
                >
                  {cell.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
