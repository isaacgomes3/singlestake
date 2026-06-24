import { AlertTriangle } from "lucide-react";

import { colorOf } from "@/lib/roulette/streetStrategy";
import {
  WHEEL_SHORT_CHAIN_NEIGHBOR_STEPS,
  type ShortNeighborGatilhoResult,
} from "@/lib/roulette/wheelShortChainGatilho";

function badgeClass(n: number): string {
  const c = colorOf(n);
  if (c === "Zero") return "border-emerald-500/50 bg-emerald-600/85 text-white";
  if (c === "Vermelho") return "border-red-400/35 bg-red-600/80 text-white";
  return "border-slate-600 bg-slate-900 text-slate-100";
}

type Props = {
  result: ShortNeighborGatilhoResult | null;
  wins: number;
  losses: number;
  onResetPlacar: () => void;
  /** Quando verdadeiro, não mostra V / D / % no cabeçalho (ex.: contadores na página). */
  hideInlinePlacar?: boolean;
};

export function WheelShortChainGatilhoPanel({
  result,
  wins,
  losses,
  onResetPlacar,
  hideInlinePlacar = false,
}: Props) {
  const hasGatilhoBlock = result != null;
  const showSection = hasGatilhoBlock || wins > 0 || losses > 0;
  if (!showSection) return null;

  const total = wins + losses;

  return (
    <section
      className={`mt-6 rounded-2xl border p-4 md:p-5 ${
        result?.active === true
          ? "border-amber-400/70 bg-gradient-to-b from-amber-950/40 to-slate-900/80 shadow-lg shadow-amber-900/15 ring-1 ring-amber-400/35"
          : "border-slate-800 bg-slate-900/55"
      }`}
      aria-label="Gatilho de zona no cilindro após giro curto"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
          {result?.active ? (
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" aria-hidden />
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-100">
              Gatilho cilindro — zona ±{WHEEL_SHORT_CHAIN_NEIGHBOR_STEPS} após giro curto
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          {!hideInlinePlacar ? (
            <div className="flex gap-2 text-xs font-mono">
              <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                V {wins}
              </span>
              <span className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-rose-200">
                D {losses}
              </span>
              <span className="rounded-lg border border-slate-600 bg-slate-950/60 px-2.5 py-1 text-slate-400">
                {total > 0 ? `${((wins / total) * 100).toFixed(1)}%` : "—"}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onResetPlacar}
            className="rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-700/80"
          >
            Zerar placar zona
          </button>
        </div>
      </div>

      {result ? (
        <>
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="font-semibold text-slate-400">Após anterior curto (seguinte)</div>
              <ul className="mt-2 space-y-1 font-mono text-slate-300">
                <li>Curto: {result.stats.afterShort.short}</li>
                <li>Médio: {result.stats.afterShort.mid}</li>
                <li>Longo: {result.stats.afterShort.long}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="font-semibold text-slate-400">Após anterior não curto</div>
              <ul className="mt-2 space-y-1 font-mono text-slate-300">
                <li>Curto: {result.stats.afterNotShort.short}</li>
                <li>Médio: {result.stats.afterNotShort.mid}</li>
                <li>Longo: {result.stats.afterNotShort.long}</li>
              </ul>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span>
              P(curto|curto):{" "}
              <span className="font-mono text-slate-300">
                {result.stats.pNextShortAfterShort != null
                  ? (result.stats.pNextShortAfterShort * 100).toFixed(1) + "%"
                  : "—"}
              </span>
            </span>
            <span>
              P(curto|não curto):{" "}
              <span className="font-mono text-slate-300">
                {result.stats.pNextShortAfterNotShort != null
                  ? (result.stats.pNextShortAfterNotShort * 100).toFixed(1) + "%"
                  : "—"}
              </span>
            </span>
            <span>
              P(longo|curto):{" "}
              <span className="font-mono text-slate-300">
                {result.stats.pNextLongAfterShort != null
                  ? (result.stats.pNextLongAfterShort * 100).toFixed(1) + "%"
                  : "—"}
              </span>
            </span>
          </div>

          {result.active ? (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-slate-950/60 p-3">
              <p className="text-sm font-semibold text-amber-200">
                Alerta activo — último número no cilindro:{" "}
                <span className="font-mono text-amber-50">{result.center}</span>{" "}
                <span className="font-normal text-amber-200/80">
                  (última transição: {result.lastDistance} casas)
                </span>
              </p>
              <p className="mt-2 text-[11px] text-amber-100/85">
                Zona (±{WHEEL_SHORT_CHAIN_NEIGHBOR_STEPS} no anel, {result.zoneNumbers.length} números):
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {result.zoneNumbers.map((n) => {
                  const isCenter = n === result.center;
                  return (
                    <span
                      key={`z-${n}`}
                      aria-current={isCenter ? "true" : undefined}
                      className={`inline-flex min-w-[2rem] items-center justify-center rounded-md border px-2 py-1 text-center text-xs font-bold tabular-nums transition ${badgeClass(n)} ${
                        isCenter
                          ? "relative z-[1] scale-110 border-amber-200/90 shadow-md shadow-amber-500/25 ring-2 ring-amber-300/90 ring-offset-2 ring-offset-slate-950"
                          : ""
                      }`}
                    >
                      {n}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

        </>
      ) : null}
    </section>
  );
}
