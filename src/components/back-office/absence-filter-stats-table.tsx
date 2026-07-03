import type { AbsenceFilterStatRow, ZoneAbsenceFilterStatsBlock } from "@/lib/roulette/zoneAbsenceFilterStats";
import { ABSENCE_FILTER_STATS_MAX_WIN_LOOKAHEAD } from "@/lib/roulette/zoneAbsenceFilterStats";
import { cn } from "@/lib/utils";

type Props = {
  block: ZoneAbsenceFilterStatsBlock;
  labels: {
    hint: string;
    maxInWindow: string;
    colFilter: string;
    colSample: string;
    colMaxAtTrigger: string;
    colWinAfter: string;
    colUnresolved: string;
    noData: string;
    spinLabel: (n: number) => string;
  };
};

function rowHasData(row: AbsenceFilterStatRow): boolean {
  return row.sampleSize > 0;
}

export function AbsenceFilterStatsTable({ block, labels }: Props) {
  const activeRows = block.filters.filter(rowHasData);
  const winColumns = Array.from({ length: ABSENCE_FILTER_STATS_MAX_WIN_LOOKAHEAD }, (_, i) => i + 1);

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
              <th className="px-2 py-2 text-right font-semibold">{labels.colMaxAtTrigger}</th>
              {winColumns.map((n) => (
                <th key={n} className="px-1.5 py-2 text-center font-semibold tabular-nums">
                  {labels.spinLabel(n)}
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
                <td className="px-2 py-1.5 text-right tabular-nums text-text-primary">
                  {row.maxAbsenceAtTrigger > 0 ? row.maxAbsenceAtTrigger : "—"}
                </td>
                {winColumns.map((n) => (
                  <td
                    key={n}
                    className={cn(
                      "px-1.5 py-1.5 text-center tabular-nums",
                      (row.winsBySpin[n] ?? 0) > 0 ? "font-semibold text-success" : "text-text-secondary",
                    )}
                  >
                    {row.winsBySpin[n] ?? 0}
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
