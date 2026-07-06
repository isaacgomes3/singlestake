import type { TableCrossingAbsenceTriggerRow } from "@/lib/back-office/automation-stats-types";
import { cn } from "@/lib/utils";

type Labels = {
  colTable: string;
  colCorMax: string;
  colCorTrigger: string;
  colAltMax: string;
  colAltTrigger: string;
  noData: string;
};

type Props = {
  rows: readonly TableCrossingAbsenceTriggerRow[];
  labels: Labels;
};

export function CrossingAbsencePerTableTable({ rows, labels }: Props) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-text-secondary">{labels.noData}</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
            <th className="px-3 py-2.5 font-semibold">{labels.colTable}</th>
            <th className="px-3 py-2.5 text-right font-semibold">{labels.colCorMax}</th>
            <th className="px-3 py-2.5 text-right font-semibold">{labels.colCorTrigger}</th>
            <th className="px-3 py-2.5 text-right font-semibold">{labels.colAltMax}</th>
            <th className="px-3 py-2.5 text-right font-semibold">{labels.colAltTrigger}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tableId} className="border-b border-border-color/60 last:border-0">
              <td className="px-3 py-2 font-medium text-text-primary">{row.label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{row.corAlturaMax}</td>
              <td
                className={cn(
                  "px-3 py-2 text-right tabular-nums font-semibold",
                  row.corAlturaAuto ? "text-success" : "text-text-primary",
                )}
              >
                {row.corAlturaTrigger}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                {row.alturaParidadeMax}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-right tabular-nums font-semibold",
                  row.alturaParidadeAuto ? "text-success" : "text-text-primary",
                )}
              >
                {row.alturaParidadeTrigger}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
