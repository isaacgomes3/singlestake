import { cn } from "@/lib/utils";
import { useStrategyGlobalSnapshot } from "@/hooks/useStrategyGlobalSnapshot";
import { isStrategyGlobalEnabled } from "@/lib/roulette/strategyGlobalClient";
import type { StrategyGlobalKind, StrategyGlobalLifetimeAggregate } from "@/lib/roulette/strategyGlobalTypes";

type Props = {
  kind: StrategyGlobalKind;
  compact?: boolean;
  className?: string;
};

function pct(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "—";
  return `${((wins / total) * 100).toFixed(1)}%`;
}

function formatSince(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function LifetimeBlock({
  title,
  data,
  compact,
}: {
  title: string;
  data: StrategyGlobalLifetimeAggregate;
  compact?: boolean;
}) {
  const total = data.wins + data.losses;
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-800/80 bg-slate-950/40 p-3",
        compact && "p-2",
      )}
    >
      <p
        className={cn(
          "font-semibold uppercase tracking-wide text-slate-400",
          compact ? "text-[8px]" : "text-[9px] sm:text-[10px]",
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "mt-1 font-extrabold tabular-nums text-emerald-300",
          compact ? "text-lg" : "text-xl sm:text-2xl",
        )}
      >
        {pct(data.wins, data.losses)}
      </p>
      <p className={cn("mt-0.5 tabular-nums text-slate-500", compact ? "text-[8px]" : "text-[9px]")}>
        {total > 0 ? `${data.wins}V / ${data.losses}D` : "sem entradas liquidadas"}
      </p>
      <p className={cn("mt-1 text-slate-600", compact ? "text-[7px]" : "text-[8px]")}>
        Desde {formatSince(data.since)}
      </p>
    </div>
  );
}

/** Aproveitamento real acumulado no servidor (partilhado entre dispositivos). */
export function StrategyGlobalLifetimeStats({ kind, compact = false, className }: Props) {
  const snapshot = useStrategyGlobalSnapshot();
  if (!isStrategyGlobalEnabled() || snapshot == null) return null;

  const data = snapshot.lifetime[kind];
  const label =
    kind === "dois2fatores"
      ? "2 Fatores · histórico global"
      : kind === "fibonacci"
        ? "Fibonacci · histórico global"
        : "1 Fator · histórico global";

  return (
    <section className={cn(className)} aria-label={label}>
      <LifetimeBlock title={label} data={data} compact={compact} />
    </section>
  );
}

export function StrategyGlobalLifetimeStatsRow({ compact = false, className }: Omit<Props, "kind">) {
  const snapshot = useStrategyGlobalSnapshot();
  if (!isStrategyGlobalEnabled() || snapshot == null) return null;

  return (
    <div className={cn("grid gap-2 sm:grid-cols-1", className)}>
      <StrategyGlobalLifetimeStats kind="um1fator" compact={compact} />
    </div>
  );
}
