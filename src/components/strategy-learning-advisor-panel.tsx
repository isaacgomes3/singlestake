import { Brain, Sparkles } from "lucide-react";

import type { StrategyLearningAdvisorSnapshot } from "@/lib/roulette/strategyLearningAdvisor";
import type { UmFatorLearningSettings } from "@/lib/roulette/umFatorPatternLearning";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: StrategyLearningAdvisorSnapshot;
  activeStrategy: "um1fator" | "dois2fatores";
  onUpdateUmSettings: (patch: Partial<UmFatorLearningSettings>) => void;
  className?: string;
};

const KIND_LABEL: Record<string, string> = {
  trigger: "Gatilho",
  sequence: "Sequência",
  period: "Período",
};

const CONFIDENCE_CLASS: Record<string, string> = {
  alta: "text-emerald-400",
  media: "text-amber-300",
  baixa: "text-slate-500",
};

export function StrategyLearningAdvisorPanel({
  snapshot,
  activeStrategy,
  onUpdateUmSettings,
  className,
}: Props) {
  const { um1fator, dois2fatores, insights } = snapshot;
  const strategyInsights = insights.filter((i) => i.strategy === activeStrategy);
  const totalResolved =
    activeStrategy === "um1fator" ? um1fator.totalResolved : dois2fatores.totalResolved;
  const bucketCount =
    activeStrategy === "um1fator"
      ? Object.keys(um1fator.buckets).length
      : Object.keys(dois2fatores.buckets).length;

  return (
    <section
      className={cn(
        "rounded-xl border border-violet-900/35 bg-[#0a0e18]/95 px-3 py-3",
        className,
      )}
      aria-label="IA observacional das estratégias"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-violet-200/90">
              IA · Aprendizado observacional
            </p>
            <p className="text-[8px] text-slate-500">
              {totalResolved} entradas · {bucketCount} padrões · não altera a lógica
            </p>
          </div>
        </div>
        {activeStrategy === "um1fator" ? (
          <label className="flex shrink-0 items-center gap-1.5 text-[8px] text-slate-400">
            <input
              type="checkbox"
              checked={um1fator.settings.enabled}
              onChange={(e) => onUpdateUmSettings({ enabled: e.target.checked })}
              className="rounded border-slate-600"
            />
            Activo
          </label>
        ) : null}
      </div>

      <p className="mt-2 rounded-md border border-slate-800/80 bg-slate-900/40 px-2 py-1.5 text-[8px] leading-relaxed text-slate-400">
        Identifica gatilhos, sequências e períodos (recuperação / ausência) com maior
        aproveitamento <strong className="font-semibold text-slate-300">dentro das regras actuais</strong>.
        Sugestões apenas informativas.
      </p>

      {strategyInsights.length === 0 ? (
        <p className="mt-3 text-center text-[9px] text-slate-500">
          A recolher amostras… São necessários mais giros resolvidos.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {strategyInsights.map((insight) => (
            <li
              key={`${insight.strategy}-${insight.kind}-${insight.label}`}
              className="flex items-start gap-2 rounded-lg border border-slate-800/70 bg-[#060a14]/80 px-2 py-1.5"
            >
              <Sparkles
                className={cn("mt-0.5 h-3 w-3 shrink-0", CONFIDENCE_CLASS[insight.confidence])}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">
                  {KIND_LABEL[insight.kind] ?? insight.kind}
                </p>
                <p className="truncate text-[9px] font-medium text-slate-200">{insight.label}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-bold tabular-nums text-emerald-300">
                  {insight.winPct.toFixed(0)}%
                </p>
                <p className="text-[7px] tabular-nums text-slate-500">n={insight.samples}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {activeStrategy === "um1fator" && um1fator.settings.motorInfluence ? (
        <p className="mt-2 text-[8px] text-amber-400/90">
          Atenção: influência no motor activa (opt-in).
        </p>
      ) : null}
    </section>
  );
}
