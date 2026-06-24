import { MapPin } from "lucide-react";

import {
  doisFatoresExteriorCellKey,
  doisFatoresFactorLabel,
  type DoisFatoresActive,
  type DoisFatoresFactor,
} from "@/lib/roulette/doisFatoresStrategy";
import { colorOf } from "@/lib/roulette/streetStrategy";
import { cn } from "@/lib/utils";

function numberCellClass(n: number) {
  const c = colorOf(n);
  if (c === "Zero") return "border-emerald-500/50 bg-emerald-600/85 text-white";
  if (c === "Vermelho") return "border-red-400/35 bg-red-600/80 text-white";
  return "border-slate-600 bg-slate-900 text-slate-100";
}

type Props = {
  active: DoisFatoresActive | null;
  resultPinNumber?: number | null;
  /** Tapete ~2× maior (sala rotativa). */
  enlarged?: boolean;
  /** Destaca só o factor de alerta (1 Fator). */
  singleFactor?: boolean;
};

function ChipFactor({ label = "1", enlarged }: { label?: string; enlarged?: boolean }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-100/95 bg-amber-200 font-black text-amber-950 shadow-lg ring-2 ring-black/30",
        enlarged ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm",
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

export function DoisFatoresTable({ active, resultPinNumber = null, enlarged = false, singleFactor = false }: Props) {
  const highlighted = new Set<string>();
  const factorByKey = new Map<string, DoisFatoresFactor>();

  if (active) {
    const factors = singleFactor ? [active.factor1] : [active.factor1, active.factor2];
    for (const f of factors) {
      const key = doisFatoresExteriorCellKey(f);
      highlighted.add(key);
      factorByKey.set(key, f);
    }
  }

  const pinClass = enlarged
    ? "h-10 w-10 fill-amber-400 text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] sm:h-12 sm:w-12"
    : "h-5 w-5 fill-amber-400 text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] sm:h-6 sm:w-6";

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-violet-500/25 bg-slate-950/90 shadow-inner ring-1 ring-white/5",
        enlarged ? "p-5 sm:p-6" : "p-3",
      )}
    >
      <div
        className={cn(
          "mx-auto",
          enlarged
            ? "min-w-[min(100%,1120px)] max-w-[1440px] text-sm sm:text-base"
            : "min-w-[min(100%,560px)] max-w-[720px] text-[11px] sm:text-xs",
        )}
      >
        <div className="flex items-stretch gap-0.5">
          <div
            className={cn(
              "relative flex shrink-0 items-stretch rounded-l-md border font-bold",
              enlarged ? "w-[4.5rem] text-base sm:w-[5.5rem] sm:text-lg" : "w-9 sm:w-11 sm:text-sm",
              numberCellClass(0),
            )}
          >
            <div className="relative flex flex-1 items-center justify-center">
              0
              {resultPinNumber === 0 ? (
                <span className="pointer-events-none absolute left-1/2 top-0 z-[25] -translate-x-1/2 -translate-y-[28%]">
                  <MapPin className={pinClass} aria-hidden />
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-12 gap-0.5">
            {Array.from({ length: 12 }, (_, col) => {
              const streetId = col + 1;
              const top = 3 * (col + 1);
              const mid = 3 * col + 2;
              const bot = 3 * col + 1;

              return (
                <div key={streetId} className="relative flex min-w-0 flex-col gap-0.5">
                  {[top, mid, bot].map((n) => (
                    <div
                      key={n}
                      className={cn(
                        "relative flex aspect-[5/4] items-center justify-center rounded-sm border font-bold tabular-nums",
                        enlarged ? "min-h-[52px] sm:min-h-[60px] sm:text-base" : "min-h-[26px] sm:min-h-[30px] sm:text-xs",
                        numberCellClass(n),
                        active?.referenceNumber === n &&
                          "ring-2 ring-violet-400/70 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]",
                      )}
                    >
                      {n}
                      {resultPinNumber === n ? (
                        <span className="pointer-events-none absolute left-1/2 top-0 z-[25] -translate-x-1/2 -translate-y-[30%]">
                          <MapPin className={pinClass} aria-hidden />
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            "mt-0.5 grid grid-cols-12 gap-0.5",
            enlarged
              ? "pl-[calc(4.5rem+0.125rem)] sm:pl-[calc(5.5rem+0.125rem)]"
              : "pl-[calc(2.25rem+0.125rem)] sm:pl-[calc(2.75rem+0.125rem)]",
          )}
        >
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

        <div
          className={cn(
            "mt-0.5 grid grid-cols-12 gap-0.5",
            enlarged
              ? "pl-[calc(4.5rem+0.125rem)] sm:pl-[calc(5.5rem+0.125rem)]"
              : "pl-[calc(2.25rem+0.125rem)] sm:pl-[calc(2.75rem+0.125rem)]",
          )}
        >
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
            const isFactor = highlighted.has(cell.key);
            const factor = factorByKey.get(cell.key);
            const base = cn(
              "relative flex flex-col items-center justify-center rounded-sm border py-2 font-semibold",
              enlarged ? "min-h-[88px]" : "min-h-[44px]",
            );
            let cls = "border-slate-700 bg-slate-900/90 text-slate-200";
            if ("red" in cell) cls = "border-red-500/40 bg-red-700/70 text-red-50";
            if ("black" in cell) cls = "border-slate-600 bg-slate-800 text-slate-100";
            if (isFactor) cls = `${cls} ring-2 ring-amber-400/55 brightness-110`;

            return (
              <div
                key={cell.key}
                className={cn(base, cls)}
                style={{ gridColumn: `span ${cell.span} / span ${cell.span}` }}
                aria-label={factor ? `Factor: ${doisFatoresFactorLabel(factor)}` : undefined}
              >
                {isFactor ? <ChipFactor enlarged={enlarged} /> : null}
                <span
                  className={cn(
                    "red" in cell || "black" in cell ? (enlarged ? "text-3xl" : "text-lg") : "",
                    cell.key === "low" || cell.key === "high"
                      ? "whitespace-pre-line text-center leading-tight"
                      : "",
                    isFactor && "relative z-[1]",
                  )}
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
