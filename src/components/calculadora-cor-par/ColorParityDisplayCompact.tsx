import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";

import type { CombinedAlert } from "@/lib/calculadoraCorPar/useCombinedAlerts";
import { explainCalculadoraStreaks } from "@/lib/calculadoraCorPar/calculadoraStreakExplain";

import { CalculadoraRouletteNumber } from "./RouletteNumber";
function heightLabel(h: "baixo" | "alto"): string {
  return h === "baixo" ? "BAIXO" : "ALTO";
}

type Props = {
  combinedAlert: CombinedAlert;
  colorSequenceCount: number;
  heightSequenceCount: number;
  colorScore: number;
  heightScore: number;
  gridLayout: (number | null)[][];
  /** Histórico cronológico para mostrar o sufixo que sustenta a indicação (não só o último número). */
  historyChronological?: readonly number[];
};
export function ColorParityDisplayCompact({
  combinedAlert,
  colorSequenceCount,
  heightSequenceCount,
  colorScore,
  heightScore,
  gridLayout,
  historyChronological,
}: Props) {
  const showBet =
    combinedAlert.isActive &&
    combinedAlert.color != null &&
    combinedAlert.height != null;

  const streakExplain = useMemo(() => {
    if (!historyChronological || historyChronological.length === 0) return null;
    return explainCalculadoraStreaks(historyChronological);
  }, [historyChronological]);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:p-5">
      {showBet ? (
        <div className="mb-4 rounded-xl border-2 border-amber-400/70 bg-gradient-to-b from-amber-950/50 to-slate-950/80 px-4 py-4 shadow-lg shadow-amber-900/20 ring-1 ring-amber-300/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" aria-hidden />
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-200/90">
                Indicação de aposta
              </p>
              <p className="mt-1 text-2xl font-black leading-tight tracking-tight text-amber-50 sm:text-3xl">
                {combinedAlert.color!.toUpperCase()} · {heightLabel(combinedAlert.height!)}
              </p>
              <p className="mt-2 font-mono text-sm text-amber-100/95">
                Confiança {combinedAlert.confidence}% · sequência{" "}
                {combinedAlert.colorSequenceCount + combinedAlert.heightSequenceCount}
              </p>
              {streakExplain ? (
                <div className="mt-3 space-y-1.5 rounded-lg border border-amber-500/20 bg-slate-950/60 px-3 py-2 text-left text-[11px] leading-snug text-amber-50/90">
                  <p className="font-semibold text-amber-200/95">Base no histórico (sufixo)</p>
                  <p className="text-amber-50/85">
                    <span className="text-slate-400">Cor</span> · {streakExplain.color.groupLabel} ×{" "}
                    {streakExplain.color.count}
                    <span className="ml-1 font-mono text-slate-300">
                      [{streakExplain.color.sampleNewestFirst.join(" · ")}]
                    </span>
                  </p>
                  <p className="text-amber-50/85">
                    <span className="text-slate-400">Altura</span> · {streakExplain.height.groupLabel} ×{" "}
                    {streakExplain.height.count}
                    <span className="ml-1 font-mono text-slate-300">
                      [{streakExplain.height.sampleNewestFirst.join(" · ")}]
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-500">
                    A indicação segue estes sufixos paralelos no fim do espelho (mais à esquerda = mais recente na
                    lista).
                  </p>
                </div>
              ) : null}            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-slate-600 bg-slate-950/50 px-4 py-3 text-center text-sm text-slate-400">
          Sem indicação ativa — são precisas sequências ≥2 em <strong className="text-slate-300">cor</strong> e
          em <strong className="text-slate-300">altura</strong> (1–18 / 19–36) ao mesmo tempo (último giro ≠ 0).
        </div>
      )}

      <div className="grid grid-cols-6 gap-2">
        {gridLayout.flatMap((row, rowIndex) =>
          row.map((number, colIndex) => (
            <div key={`g-${rowIndex}-${colIndex}`} className="flex justify-center">
              {number !== null ? (
                <CalculadoraRouletteNumber number={number} onClick={() => {}} size="sm" />
              ) : (
                <div className="h-8 w-8 rounded-lg border-2 border-dashed border-slate-600" />
              )}
            </div>
          )),
        )}
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-3 text-sm text-slate-300">
        <span>
          Cor {colorSequenceCount} · Alt {heightSequenceCount}
        </span>
        <span className="font-mono text-slate-200">
          {colorScore.toFixed(1)} / {heightScore.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
