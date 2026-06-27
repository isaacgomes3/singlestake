import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState } from "react";

import type {
  AutomationOpenBet,
  AutomationSimRound,
} from "@/lib/back-office/rouletteAutomationSim";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

function roundBadgeLabel(badge: string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (badge === "VITÓRIA" || badge === "WIN") return t("shared.rounds.win");
  if (badge === "DERROTA" || badge === "LOSS") return t("shared.rounds.loss");
  if (badge === "EM JOGO" || badge === "IN PLAY") return t("shared.rounds.inPlay");
  return badge;
}

function formatRoundDescription(
  round: AutomationSimRound,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const parts = [round.tableLabel];
  if (round.resultNumber != null) {
    parts.push(t("shared.rounds.spin", { n: round.resultNumber }));
  }
  if (round.recovery > 0) {
    parts.push(t("shared.rounds.gale", { n: round.recovery }));
  }
  return parts.join(" · ");
}

function formatOpenBetDescription(
  bet: AutomationOpenBet,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const parts = [bet.tableLabel];
  if (bet.recovery > 0) {
    parts.push(t("shared.rounds.gale", { n: bet.recovery }));
  }
  return parts.join(" · ");
}

function tipoTone(round: AutomationSimRound): "success" | "danger" | "warning" {
  if (round.badge === "EM JOGO") return "warning";
  if (round.badge === "VITÓRIA" || round.badge === "WIN" || round.net > 0) return "success";
  if (round.badge === "DERROTA" || round.badge === "LOSS" || round.net < 0) return "danger";
  return "warning";
}

type Props = {
  rounds: readonly AutomationSimRound[];
  openBet?: AutomationOpenBet | null;
  balance?: number;
};

export function AutomationHistoryTable({ rounds, openBet, balance }: Props) {
  const { t } = useI18n();
  const { money, date, time } = useFormat();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className="theme-card overflow-hidden rounded-xl">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={expanded ? t("overview.historyHide") : t("overview.historyShow")}
        className={cn(
          "flex w-full items-center gap-2 border-border-color bg-bg-secondary px-4 py-3 text-left transition-colors",
          "hover:bg-bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          expanded && "border-b",
        )}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
        )}
        <h2 className="min-w-0 flex-1 text-sm font-semibold text-text-primary">
          {t("overview.historyTitle")}
        </h2>
        {(rounds.length > 0 || openBet) ? (
          <span className="shrink-0 rounded-full bg-bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary">
            {rounds.length + (openBet ? 1 : 0)}
          </span>
        ) : null}
      </button>
      {expanded ? (
      <div id={panelId} className="overflow-x-auto">
        <table className="theme-table w-full min-w-[360px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-color text-[11px] uppercase tracking-wide text-text-secondary">
              <th className="px-4 py-2.5 font-semibold">{t("shared.columns.date")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("shared.columns.description")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("shared.columns.type")}</th>
              <th className="px-4 py-2.5 text-right font-semibold">{t("shared.columns.value")}</th>
            </tr>
          </thead>
          <tbody>
            {openBet ? (
              <tr className="border-b border-border-color bg-warning/5">
                <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                  {date(openBet.openedAt)}
                  <span className="mt-0.5 block text-[11px] tabular-nums">{time(openBet.openedAt)}</span>
                </td>
                <td className="px-4 py-3 text-text-primary">{formatOpenBetDescription(openBet, t)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-warning">
                    {t("shared.rounds.inPlay")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-semibold tabular-nums text-warning">
                    {money(openBet.stake)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">
                    {t("shared.rounds.inPlayHint")}
                    {balance != null
                      ? ` · ${t("shared.rounds.balanceAfter", { amount: money(balance) })}`
                      : null}
                  </p>
                </td>
              </tr>
            ) : null}
            {rounds.length === 0 && !openBet ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-secondary">
                  {t("overview.historyEmpty")}
                </td>
              </tr>
            ) : (
              rounds.map((round) => {
                const tone = tipoTone(round);
                const isCredit = round.net >= 0;
                return (
                  <tr key={round.id} className="border-b border-border-color last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {date(round.ts)}
                      <span className="mt-0.5 block text-[11px] tabular-nums">{time(round.ts)}</span>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{formatRoundDescription(round, t)}</td>
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
                        {roundBadgeLabel(round.badge, t)}
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
                        {money(Math.abs(round.net))}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-text-secondary">
                        {t("shared.rounds.balanceAfter", { amount: money(round.balanceAfter) })}
                      </p>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      ) : null}
    </div>
  );
}
