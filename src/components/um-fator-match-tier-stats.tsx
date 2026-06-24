import {
  normalizeUmFatorMatchTierStats,
  umFatorMatchTierAproveitamentoPct,
} from "@/lib/roulette/entryWinBreakdown";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { cn } from "@/lib/utils";

type Props = {
  stats: RotatingRoomSessionStats;
  compact?: boolean;
  className?: string;
};

function TierCell({
  label,
  wins,
  losses,
  compact,
}: {
  label: string;
  wins: number;
  losses: number;
  compact?: boolean;
}) {
  const pct = umFatorMatchTierAproveitamentoPct({ wins, losses });
  const total = wins + losses;

  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-violet-900/40 bg-violet-950/25 px-2 py-1.5 text-center",
        compact && "px-1.5 py-1",
      )}
      title={`${wins} vitórias · ${losses} derrotas`}
    >
      <p
        className={cn(
          "font-semibold uppercase tracking-wide text-violet-300/80",
          compact ? "text-[7px]" : "text-[8px] sm:text-[9px]",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-extrabold tabular-nums text-emerald-300",
          compact ? "text-sm" : "text-base sm:text-lg",
        )}
      >
        {pct != null ? `${pct.toFixed(0)}%` : "—"}
      </p>
      <p className={cn("mt-0.5 tabular-nums text-slate-500", compact ? "text-[7px]" : "text-[8px]")}>
        {total > 0 ? `${wins}V / ${losses}D` : "sem dados"}
      </p>
    </div>
  );
}

export function UmFatorMatchTierStats({ stats, compact = false, className }: Props) {
  const tier = normalizeUmFatorMatchTierStats(stats.umFatorMatchTier);

  return (
    <section
      className={cn(className)}
      aria-label="Aproveitamento 1 Fator por coincidência de factores no gatilho"
    >
      <p
        className={cn(
          "mb-1.5 text-center font-semibold uppercase tracking-wide text-slate-500",
          compact ? "text-[7px]" : "text-[8px] sm:text-[9px]",
        )}
      >
        Acerto por gatilho
      </p>
      <div className={cn("grid grid-cols-2 gap-2", compact && "gap-1.5")}>
        <TierCell
          label="2 factores iguais"
          wins={tier.twoEqualFactors.wins}
          losses={tier.twoEqualFactors.losses}
          compact={compact}
        />
        <TierCell
          label="3 factores iguais"
          wins={tier.threeEqualFactors.wins}
          losses={tier.threeEqualFactors.losses}
          compact={compact}
        />
      </div>
    </section>
  );
}
