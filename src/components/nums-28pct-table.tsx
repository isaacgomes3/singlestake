import { MapPin } from "lucide-react";

import { colorOf, type ZoneIndication } from "@/lib/roulette/streetStrategy";

/** Tapete com dois exclusivos; `indicationZone` opcional (só Ruas / 2,8%). */
export type ExcludedTwoTapeteActive = {
  excludedNumbers: readonly [number, number];
  indicationZone?: ZoneIndication | null;
};

function numberCellClass(n: number) {
  const c = colorOf(n);
  if (c === "Zero") return "border-emerald-500/50 bg-emerald-600/85 text-white";
  if (c === "Vermelho") return "border-red-400/35 bg-red-600/80 text-white";
  return "border-slate-600 bg-slate-900 text-slate-100";
}

type Props = {
  active: ExcludedTwoTapeteActive | null;
  /** Realce só da metade (Baixo/Alto) quando ainda não há par de exclusão no cilindro. */
  halfHighlight?: ZoneIndication | null;
  /** Se falso, só realça os números excluídos (sem verde no resto do tapete). */
  showCoverageHighlight?: boolean;
  /** Com indicação activa: não realçar Baixo/Alto na fila exterior (tapete «cheio» só nos números). */
  showIndicationHalfOnOutsideRow?: boolean;
  /** Pino no número do último giro (feedback). */
  resultPinNumber?: number | null;
};

export function Nums28PctTable({
  active,
  halfHighlight = null,
  showCoverageHighlight = true,
  showIndicationHalfOnOutsideRow = true,
  resultPinNumber = null,
}: Props) {
  const excluded = active ? new Set<number>(active.excludedNumbers) : null;
  const zeroExcluded = excluded?.has(0) ?? false;
  const zeroIndicatedCls =
    active && zeroExcluded
      ? "border-2 border-dashed border-white/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
      : "";

  const shell =
    "overflow-x-auto rounded-2xl border border-cyan-500/25 bg-slate-950/90 p-3 shadow-inner ring-1 ring-white/5";

  return (
    <div className={shell}>
      <div className="mx-auto min-w-[min(100%,560px)] max-w-[720px] text-[11px] sm:text-xs">
        <div className="flex items-stretch gap-0.5">
          <div
            className={`flex w-9 shrink-0 items-stretch sm:w-11 ${numberCellClass(0)} rounded-l-md border font-bold sm:text-sm ${zeroIndicatedCls}`}
          >
            <div className="relative flex flex-1 items-center justify-center">
              {active && zeroExcluded ? (
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-amber-300 bg-black/15 text-inherit shadow-[0_0_12px_rgba(251,191,36,0.5)] sm:h-8 sm:w-8 sm:border-[3.5px]"
                  aria-label="Numero indicado para exclusao: 0"
                >
                  0
                </span>
              ) : (
                "0"
              )}
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
                    const isCovered = showCoverageHighlight && active && n >= 1 && n <= 36 && !isExcluded;
                    const base = numberCellClass(n);
                    /** Com indicação activa: bordo tracejado branco na célula + círculo dourado à volta do dígito (referência visual 2,8%). */
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
              { key: "low", label: "Baixo\n1–18", span: 2, zone: "1-18" as const },
              { key: "even", label: "PARES", span: 2, zone: null },
              { key: "red", label: "◆", span: 2, zone: null, red: true },
              { key: "black", label: "◆", span: 2, zone: null, black: true },
              { key: "odd", label: "ÍMPARES", span: 2, zone: null },
              { key: "high", label: "Alto\n19–36", span: 2, zone: "19-36" as const },
            ] as const
          ).map((cell) => {
            const zoneRow =
              showIndicationHalfOnOutsideRow === false
                ? null
                : (active?.indicationZone ?? (active == null ? halfHighlight : null) ?? null);
            const highlight = cell.zone != null && zoneRow != null && cell.zone === zoneRow;
            const base =
              "relative flex min-h-[44px] items-center justify-center rounded-sm border py-2.5 font-semibold";
            let cls = "border-slate-700 bg-slate-900/90 text-slate-200";
            if ("red" in cell) cls = "border-red-500/40 bg-red-700/70 text-red-50";
            if ("black" in cell) cls = "border-slate-600 bg-slate-800 text-slate-100";
            if (highlight) cls = `${cls} ring-2 ring-cyan-400/40`;

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
