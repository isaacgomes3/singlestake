import { Brain, Sparkles } from "lucide-react";

import type {
  UmFatorLearnedPattern,
  UmFatorLearningScore,
  UmFatorLearningSettings,
  UmFatorPatternLearningState,
} from "@/lib/roulette/umFatorPatternLearning";
import { cn } from "@/lib/utils";

type Props = {
  state: UmFatorPatternLearningState;
  topPatterns: UmFatorLearnedPattern[];
  activeScore?: UmFatorLearningScore | null;
  onUpdateSettings: (patch: Partial<UmFatorLearningSettings>) => void;
  compact?: boolean;
  className?: string;
};

export function UmFatorPatternLearningPanel({
  state,
  topPatterns,
  activeScore,
  onUpdateSettings,
  compact = false,
  className,
}: Props) {
  const { settings } = state;

  return (
    <section
      className={cn(
        "rounded-xl border border-cyan-900/35 bg-[#0a1220]/90 px-3 py-3",
        compact && "px-2 py-2",
        className,
      )}
      aria-label="Aprendizado de padrões 1 Fator"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className={cn("shrink-0 text-cyan-400", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          <div>
            <p
              className={cn(
                "font-bold uppercase tracking-wide text-cyan-200/90",
                compact ? "text-[8px]" : "text-[9px]",
              )}
            >
              IA · Padrões 1 Fator
            </p>
            <p className={cn("text-slate-500", compact ? "text-[7px]" : "text-[8px]")}>
              {state.totalResolved} entradas analisadas · {Object.keys(state.buckets).length} padrões
            </p>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-[8px] text-slate-400">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => onUpdateSettings({ enabled: e.target.checked })}
            className="rounded border-slate-600"
          />
          Activo
        </label>
      </div>

      {settings.enabled ? (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-900/40 px-2 py-1 text-[8px] text-slate-300">
              <input
                type="checkbox"
                checked={settings.motorInfluence}
                onChange={(e) => onUpdateSettings({ motorInfluence: e.target.checked })}
                className="rounded border-slate-600"
              />
              Influenciar motor (opt-in)
            </label>
            <label className="flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-900/40 px-2 py-1 text-[8px] text-slate-300">
              <input
                type="checkbox"
                checked={settings.filterWeakEntries}
                disabled={!settings.motorInfluence}
                onChange={(e) => onUpdateSettings({ filterWeakEntries: e.target.checked })}
                className="rounded border-slate-600"
              />
              Filtrar gatilhos fracos
            </label>
            <span className="rounded-md border border-slate-800 bg-slate-900/30 px-2 py-1 text-[8px] text-slate-500">
              Mín. {settings.minSamples} amostras · ≥{settings.minWinRatePct.toFixed(0)}%
            </span>
          </div>

          {activeScore ? (
            <div
              className={cn(
                "mt-2 flex items-center gap-2 rounded-lg border px-2 py-1.5",
                activeScore.recommended
                  ? "border-emerald-700/50 bg-emerald-950/30"
                  : "border-amber-700/50 bg-amber-950/25",
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                  Alerta actual
                </p>
                <p className="text-xs font-bold tabular-nums text-white">
                  {activeScore.samples > 0
                    ? `${activeScore.winPct?.toFixed(0)}% histórico`
                    : "Sem histórico para este padrão"}
                  <span className="ml-1.5 text-[10px] font-medium text-slate-400">
                    conf. {activeScore.confidenceScore.toFixed(0)}
                  </span>
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase",
                  activeScore.recommended
                    ? "bg-emerald-900/60 text-emerald-300"
                    : "bg-amber-900/60 text-amber-300",
                )}
              >
                {activeScore.recommended ? "Prioritário" : "Fraco"}
              </span>
            </div>
          ) : null}

          <div className="mt-2.5">
            <p className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
              Melhores padrões aprendidos
            </p>
            {topPatterns.length === 0 ? (
              <p className="text-[8px] text-slate-600">
                A recolher dados das sequências… São necessários alguns giros com entradas resolvidas.
              </p>
            ) : (
              <ul className="space-y-1">
                {topPatterns.map((p) => (
                  <li
                    key={p.key}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-800/80 bg-slate-900/30 px-2 py-1"
                    title={p.label}
                  >
                    <span className="min-w-0 truncate text-[8px] text-slate-300">{p.label}</span>
                    <span className="shrink-0 text-[9px] font-bold tabular-nums text-emerald-300">
                      {p.winPct.toFixed(0)}%
                      <span className="ml-1 font-normal text-slate-500">({p.samples})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[8px] text-slate-600">
          Activa para a IA aprender com o histórico e priorizar gatilhos mais acertivos.
        </p>
      )}
    </section>
  );
}
