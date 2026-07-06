import type {
  CrossingReturnStreakStatsBlock,
  ReturnStreakStatRow,
} from "@/lib/roulette/crossingReturnStreakStats";
import { cn } from "@/lib/utils";

type Props = {
  block: CrossingReturnStreakStatsBlock;
  labels: {
    hint: string;
    maxInWindow: string;
    colFilter: string;
    colSample: string;
    colMaxStreak: string;
    colStreakDistribution: string;
    colUnresolved: string;
    noData: string;
    streakLabel: (n: number) => string;
  };
};

function rowHasData(row: ReturnStreakStatRow): boolean {
  return row.sampleSize > 0;
}

function streakKeys(row: ReturnStreakStatRow): number[] {
  return Object.keys(row.streakCounts)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export function ReturnStreakStatsTable({ block, labels }: Props) {
  const activeRows = block.filters.filter(rowHasData);
  const maxStreakCol = Math.max(
    0,
    ...activeRows.map((r) => r.maxStreakAtTrigger),
    ...activeRows.flatMap((r) => streakKeys(r)),
  );
  const streakColumns = Array.from({ length: Math.min(maxStreakCol + 1, 8) }, (_, i) => i);

  if (activeRows.length === 0) {
    return (
      <div className="mt-4 space-y-2">
        <p className="text-[11px] text-text-secondary">{labels.hint}</p>
        <p className="text-sm text-text-secondary">{labels.noData}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[11px] text-text-secondary">{labels.hint}</p>
      <p className="text-[11px] font-medium tabular-nums text-text-primary">
        {labels.maxInWindow}:{" "}
        <span className="font-bold">{block.maxAbsenceInWindow}</span>
      </p>
      <div className="overflow-x-auto rounded-xl border border-border-color">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-border-color bg-bg-secondary text-[10px] uppercase tracking-wide text-text-secondary">
              <th className="sticky left-0 z-10 bg-bg-secondary px-2 py-2 font-semibold">
                {labels.colFilter}
              </th>
              <th className="px-2 py-2 text-right font-semibold">{labels.colSample}</th>
              <th className="px-2 py-2 text-right font-semibold">{labels.colMaxStreak}</th>
              {streakColumns.map((n) => (
                <th key={n} className="px-1.5 py-2 text-center font-semibold tabular-nums">
                  {labels.streakLabel(n)}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold">{labels.colUnresolved}</th>
            </tr>
          </thead>
          <tbody>
            {block.filters.map((row) => (
              <tr
                key={row.filterSpins}
                className={cn(
                  "border-b border-border-color last:border-0",
                  !rowHasData(row) && "opacity-40",
                )}
              >
                <td className="sticky left-0 z-10 bg-bg-primary px-2 py-1.5 font-medium tabular-nums text-text-primary">
                  {row.filterSpins}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-text-secondary">
                  {row.sampleSize > 0 ? row.sampleSize : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-text-primary">
                  {row.maxStreakAtTrigger > 0 ? row.maxStreakAtTrigger : "—"}
                </td>
                {streakColumns.map((n) => (
                  <td
                    key={n}
                    className={cn(
                      "px-1.5 py-1.5 text-center tabular-nums",
                      (row.streakCounts[n] ?? 0) > 0 ? "text-text-primary" : "text-text-secondary",
                    )}
                  >
                    {row.streakCounts[n] ?? "—"}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right tabular-nums text-text-secondary">
                  {row.unresolved > 0 ? row.unresolved : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
