import type { AutomationSimRound } from "@/lib/back-office/rouletteAutomationSim";
import { formatBrl } from "@/lib/back-office/mock-data";
import { cn } from "@/lib/utils";

function formatRoundDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-BR");
}

function formatRoundDescription(round: AutomationSimRound): string {
  const parts = [round.tableLabel];
  if (round.resultNumber != null) parts.push(`Giro ${round.resultNumber}`);
  if (round.recovery > 0) parts.push(`gale ${round.recovery}`);
  return parts.join(" · ");
}

function tipoTone(round: AutomationSimRound): "success" | "danger" | "warning" {
  if (round.badge === "VITÓRIA" || round.net > 0) return "success";
  if (round.badge === "DERROTA" || round.net < 0) return "danger";
  return "warning";
}

export function AutomationHistoryTable({ rounds }: { rounds: readonly AutomationSimRound[] }) {
  return (
    <div className="theme-card overflow-hidden rounded-xl">
      <div className="border-b border-border-color bg-bg-secondary px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Histórico automação</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="theme-table w-full min-w-[360px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-color text-[11px] uppercase tracking-wide text-text-secondary">
              <th className="px-4 py-2.5 font-semibold">Data</th>
              <th className="px-4 py-2.5 font-semibold">Descrição</th>
              <th className="px-4 py-2.5 font-semibold">Tipo</th>
              <th className="px-4 py-2.5 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rounds.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-secondary">
                  Nenhuma rodada liquidada neste ciclo.
                </td>
              </tr>
            ) : (
              rounds.map((round) => {
                const tone = tipoTone(round);
                const isCredit = round.net >= 0;
                return (
                  <tr key={round.id} className="border-b border-border-color last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {formatRoundDate(round.ts)}
                      <span className="mt-0.5 block text-[11px] tabular-nums">
                        {new Date(round.ts).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{formatRoundDescription(round)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-bold uppercase tracking-wide",
                          tone === "success"
                            ? "text-success"
                            : tone === "danger"
                              ? "text-danger"
                              : "text-warning",
                        )}
                      >
                        {round.badge}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p
                        className={cn(
                          "font-semibold tabular-nums",
                          isCredit ? "text-success" : "text-danger",
                        )}
                      >
                        {isCredit ? "+" : "−"}
                        {formatBrl(Math.abs(round.net))}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-text-secondary">
                        saldo {formatBrl(round.balanceAfter)}
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
