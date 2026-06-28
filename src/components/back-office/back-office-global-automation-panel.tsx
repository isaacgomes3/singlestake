import { useCallback, useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";

import { AutomationHistoryTable } from "@/components/back-office/automation-history-table";
import { RouletteAutomationSimulatorPanel } from "@/components/back-office/roulette-automation-simulator-panel";
import { Button } from "@/components/ui/button";
import {
  fetchGlobalAutomationFinance,
  type GlobalAutomationFinance,
  type GlobalAutomationLedgerEntry,
  type GlobalAutomationLedgerTotals,
} from "@/lib/back-office/global-automation-api";
import {
  finalizeAutomationSimState,
  ROULETTE_AUTOMATION_INITIAL_BANK,
} from "@/lib/back-office/rouletteAutomationSim";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

function GlobalAutomationLedgerTable({
  entries,
  totals,
  loading,
}: {
  entries: readonly GlobalAutomationLedgerEntry[];
  totals: GlobalAutomationLedgerTotals | null;
  loading: boolean;
}) {
  const { t } = useI18n();
  const { money, dateTime } = useFormat();

  const operationsNet = totals?.operationsNet ?? 0;

  return (
    <div className="space-y-4">
      <section className="theme-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("finance.globalAutomation.ledgerSummaryTitle")}
        </h3>
        <p className="mt-1 text-xs text-text-secondary">
          {t("finance.globalAutomation.ledgerSummaryHint")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2">
            <p className="text-[11px] text-text-secondary">
              {t("finance.globalAutomation.initialCapitalLabel")}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-text-primary">
              {loading ? "…" : money(totals?.capitalCredit ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
            <p className="text-[11px] text-emerald-200/80">
              {t("finance.globalAutomation.totalWins")}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-100">
              {loading ? "…" : money(totals?.settlementCredits ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2">
            <p className="text-[11px] text-red-200/80">
              {t("finance.globalAutomation.totalLosses")}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-red-100">
              {loading ? "…" : money(totals?.settlementDebits ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-border-color bg-bg-secondary px-3 py-2">
            <p className="text-[11px] text-text-secondary">
              {t("finance.globalAutomation.operationsNet")}
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg font-bold tabular-nums",
                operationsNet >= 0 ? "text-success" : "text-danger",
              )}
            >
              {loading ? "…" : money(operationsNet)}
            </p>
          </div>
        </div>
      </section>

      <section className="theme-card overflow-hidden rounded-xl">
        <div className="border-b border-border-color px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">
            {t("finance.globalAutomation.ledgerTitle")}
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            {t("finance.globalAutomation.ledgerSubtitle")}
          </p>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="px-4 py-8 text-sm text-text-secondary">{t("finance.ledger.loadingStatement")}</p>
          ) : entries.length === 0 ? (
            <p className="px-4 py-8 text-sm text-text-secondary">{t("finance.globalAutomation.ledgerEmpty")}</p>
          ) : (
            <table className="theme-table w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-2.5 font-semibold">{t("shared.columns.date")}</th>
                  <th className="px-4 py-2.5 font-semibold">{t("shared.columns.description")}</th>
                  <th className="px-4 py-2.5 font-semibold">{t("shared.columns.type")}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t("shared.columns.value")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id} className="border-b border-border-color last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {dateTime(row.createdAt)}
                    </td>
                    <td className="max-w-[20rem] px-4 py-3 text-text-primary">
                      <p className="truncate">{row.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-bold uppercase tracking-wide",
                          row.entryType === "credit" ? "text-success" : "text-danger",
                        )}
                      >
                        {row.entryType === "credit"
                          ? t("finance.ledger.credit")
                          : t("finance.ledger.debit")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p
                        className={cn(
                          "font-semibold tabular-nums",
                          row.entryType === "credit" ? "text-success" : "text-danger",
                        )}
                      >
                        {row.entryType === "credit" ? "+" : "−"}
                        {money(row.amount)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export function BackOfficeGlobalAutomationPanel() {
  const { t } = useI18n();
  const { money } = useFormat();
  const { state, openBet } = useRouletteAutomationSim();
  const [finance, setFinance] = useState<GlobalAutomationFinance | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await fetchGlobalAutomationFinance();
    setFinance(data.finance);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const officialBalance = finance?.balance ?? state.balance;
  const initialCapital = finance?.initialCapital ?? ROULETTE_AUTOMATION_INITIAL_BANK;
  const displayState = useMemo(
    () => finalizeAutomationSimState(state, officialBalance),
    [state, officialBalance],
  );
  const net = officialBalance - initialCapital;
  const netPct = initialCapital > 0 ? (net / initialCapital) * 100 : 0;
  const balanceMismatch =
    finance != null && Math.abs(finance.balance - finance.totals.expectedBalance) > 0.01;
  return (
    <div className="space-y-6">
      <section className="theme-card flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 text-sm text-text-secondary">
          <p className="font-semibold text-text-primary">{t("finance.globalAutomation.noticeTitle")}</p>
          <p className="mt-1">{t("finance.globalAutomation.noticeBody")}</p>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-kpi-teal/85">
              {t("finance.globalAutomation.balanceLabel")}
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-text-primary sm:text-4xl">
              {loading ? "…" : money(officialBalance)}
            </p>
            <p
              className={cn(
                "mt-2 text-sm font-semibold tabular-nums",
                net >= 0 ? "text-success" : "text-danger",
              )}
            >
              {net >= 0 ? "+" : ""}
              {money(net)} ({netPct >= 0 ? "+" : ""}
              {netPct.toFixed(2)}%) ·{" "}
              {t("finance.globalAutomation.initialCapital", { amount: money(initialCapital) })}
            </p>
            {balanceMismatch ? (
              <p className="mt-2 text-xs text-amber-300">
                {t("finance.globalAutomation.balanceMismatch")}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            {t("shared.refresh")}
          </Button>
        </div>
      </section>

      <section>
        <RouletteAutomationSimulatorPanel
          officialBalance={loading ? null : officialBalance}
          initialCapital={initialCapital}
        />
      </section>

      <section>
        <AutomationHistoryTable
          rounds={displayState.rounds}
          openBet={openBet}
          balance={officialBalance}
        />
      </section>
      <GlobalAutomationLedgerTable
        entries={finance?.entries ?? []}
        totals={finance?.totals ?? null}
        loading={loading}
      />
    </div>
  );
}
