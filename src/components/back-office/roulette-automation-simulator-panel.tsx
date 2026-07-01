import { useMemo } from "react";
import { Wallet } from "lucide-react";

import { AutomationCandlestickChart } from "@/components/back-office/automation-candlestick-chart";
import { AutomationPauseBanner } from "@/components/back-office/automation-pause-banner";
import { RotatingRoomExtensionStatus } from "@/components/rotating-room-extension-status";
import { RotatingRoomLobbyCard } from "@/components/rotating-room-panel";
import { AUTOMATION_CHART_THEME } from "@/hooks/useChartTheme";
import { useAutomationAlignedRotativaSession } from "@/hooks/useAutomationAlignedRotatingSession";
import { useRotatingRoomSetup } from "@/hooks/useRotatingRoomSetup";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import {
  finalizeAutomationSimState,
  ROULETTE_AUTOMATION_INITIAL_BANK,
} from "@/lib/back-office/rouletteAutomationSim";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

type Props = {
  /** Saldo oficial da carteira (extrato financeiro). */
  officialBalance?: number | null;
  /** Capital inicial de referência para lucro/prejuízo. */
  initialCapital?: number;
};

export function RouletteAutomationSimulatorPanel({
  officialBalance = null,
  initialCapital = ROULETTE_AUTOMATION_INITIAL_BANK,
}: Props) {
  const { t } = useI18n();
  const { money } = useFormat();
  const chart = AUTOMATION_CHART_THEME;
  const { state, openBet, config, revision } = useRouletteAutomationSim();
  const { tableIds, histories } = useRotatingRoomSetup();
  const lobbySession = useAutomationAlignedRotativaSession(tableIds, histories, {
    observeOnly: true,
  });
  const displayState = useMemo(() => {
    if (officialBalance == null) return state;
    return finalizeAutomationSimState(state, officialBalance);
  }, [state, officialBalance]);
  const chartData = displayState.chart;

  const displayBalance = officialBalance ?? state.balance;
  const net = displayBalance - initialCapital;
  const netPct = initialCapital > 0 ? (net / initialCapital) * 100 : 0;
  const freeBalance = displayBalance;

  const isPaused = config?.blocksNewEntries === true;

  return (
    <div className="automation-panel overflow-hidden rounded-2xl">
      <div className="border-b border-border-color px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {isPaused ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning">
              <span className="h-2 w-2 rounded-full bg-warning" />
              {t("overview.automation.paused")}
            </span>
          ) : openBet ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning">
              <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
              {t("overview.automation.inPlay", { table: openBet.tableLabel })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-kpi-green/80" />
              {t("overview.automation.waiting")}
            </span>
          )}
        </div>

        <AutomationPauseBanner config={config} className="mt-3" />

        <div className="mt-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-automation-title">
            <Wallet className="h-4 w-4" aria-hidden />
            {t("overview.automation.title")}
          </p>
          {openBet ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border-color/80 bg-bg-card-hover/40 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-kpi-teal/85">
                  {t("overview.automation.available")}
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-text-primary sm:text-2xl">
                  {money(freeBalance)}
                </p>
              </div>
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                  {t("overview.automation.inPlayBalance")}
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-warning sm:text-2xl">
                  {money(openBet.stake)}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-text-primary sm:text-4xl">
              {money(displayBalance)}
            </p>
          )}
          <p
            className={cn(
              "mt-2 text-sm font-semibold tabular-nums",
              net >= 0 ? "text-success" : "text-danger",
            )}
          >
            {net >= 0 ? "+" : ""}
            {money(net)} ({netPct >= 0 ? "+" : ""}
            {netPct.toFixed(2)}%) ·{" "}
            {t("overview.automation.globalBank", {
              amount: money(initialCapital),
            })}
            {openBet
              ? ` · ${t("overview.automation.total", { amount: money(displayBalance) })}`
              : null}
          </p>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="border-b border-border-color p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {t("overview.automation.chartTitle")}
            </h2>
          </div>
          <div className="h-[280px] w-full sm:h-[320px]">
            <AutomationCandlestickChart
              key={`automation-chart-${revision}-${chartData.at(-1)?.ts ?? 0}-${chartData.length}`}
              chartData={chartData}
              chart={chart}
              formatMoney={money}
              emptyLabel={t("overview.automation.chartNoCandles")}
              tooltipLabels={{
                open: t("overview.automation.chartOpen"),
                high: t("overview.automation.chartHigh"),
                low: t("overview.automation.chartLow"),
                close: t("overview.automation.chartClose"),
              }}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2 p-3 lg:max-h-[520px]">
          <RotatingRoomExtensionStatus compact />
          <RotatingRoomLobbyCard
            embedded
            openInIframe
            session={lobbySession}
            salaRoute="/sala-rotativa-um-fator"
            salaLabel="Sala Rotativa"
          />
        </div>
      </div>
    </div>
  );
}
