import type { FootballBlitzTableVariant } from "@/lib/pragmatic/dgaFootballBlitzConstants";
import type { FootballBlitzRoundStored, FootballBlitzWinner } from "@/lib/pragmatic/dgaFootballBlitzHistory";
import {
  formatSuperTrunfoRoundLabel,
  formatSuperTrunfoSpreadDisplay,
  isSuperTrunfoZeroRound,
} from "@/lib/pragmatic/superTrunfoAlert";
import { cn } from "@/lib/utils";

export function footballBlitzSpreadCellClass(
  round: Pick<FootballBlitzRoundStored, "winner" | "scoreDiff">,
  highlight: boolean,
  variant: FootballBlitzTableVariant,
  size: "history" | "stat" = "history",
): string {
  const base =
    size === "stat"
      ? "inline-flex h-9 min-w-[2.75rem] shrink-0 items-center justify-center rounded border-2 px-1 text-xl font-bold tabular-nums leading-none shadow-inner sm:h-10 sm:min-w-[3rem] sm:text-2xl"
      : "inline-flex h-6 min-w-[1.65rem] shrink-0 items-center justify-center rounded border px-0.5 text-[9px] font-bold tabular-nums leading-none shadow-inner";

  if (isSuperTrunfoZeroRound(round)) {
    return cn(
      base,
      highlight ? "border-emerald-200" : "border-emerald-500/50",
      "bg-emerald-600 text-white",
    );
  }

  if (round.winner === "home") {
    return cn(
      base,
      highlight ? "border-amber-200" : "border-amber-400/50",
      "bg-amber-500 text-black",
    );
  }
  if (round.winner === "away") {
    if (variant === "top-card") {
      return cn(
        base,
        highlight ? "border-sky-200" : "border-blue-500/50",
        "bg-blue-600 text-white",
      );
    }
    return cn(
      base,
      highlight ? "border-rose-200" : "border-rose-500/50",
      "bg-rose-600 text-white",
    );
  }
  return cn(
    base,
    highlight ? "border-white" : "border-slate-500/50",
    "bg-slate-700 text-white",
  );
}

/** @deprecated Use `footballBlitzSpreadCellClass(round, ...)`. */
export function footballBlitzSpreadCellClassByWinner(
  winner: FootballBlitzWinner,
  highlight: boolean,
  variant: FootballBlitzTableVariant,
  size: "history" | "stat" = "history",
): string {
  return footballBlitzSpreadCellClass({ winner, scoreDiff: 1 }, highlight, variant, size);
}

type FootballBlitzSpreadBadgeProps = {
  round: Pick<FootballBlitzRoundStored, "winner" | "scoreDiff">;
  variant: FootballBlitzTableVariant;
  highlight?: boolean;
  /** Posição crítica (1 ou 12) ou indicação (11) na grelha 11×2. */
  gridRole?: "critical" | "alert";
  size?: "history" | "stat";
};

export function FootballBlitzSpreadBadge({
  round,
  variant,
  highlight = false,
  gridRole,
  size = "history",
}: FootballBlitzSpreadBadgeProps) {
  return (
    <span
      className={cn(
        footballBlitzSpreadCellClass(round, highlight, variant, size),
        gridRole === "critical" && "ring-2 ring-cyan-300/90 ring-offset-1 ring-offset-[#0d1524]",
        gridRole === "alert" && "ring-2 ring-amber-200/90 ring-offset-1 ring-offset-[#0d1524]",
      )}
      title={formatSuperTrunfoRoundLabel(round, variant)}
    >
      {formatSuperTrunfoSpreadDisplay(round.scoreDiff)}
    </span>
  );
}
