import { Wallet } from "lucide-react";

import { AutomationPauseBanner } from "@/components/back-office/automation-pause-banner";
import { RotatingRoomExtensionStatus } from "@/components/rotating-room-extension-status";
import { RotatingRoomLobbyCard } from "@/components/rotating-room-panel";
import { useAutomationAlignedRotativaSession } from "@/hooks/useAutomationAlignedRotatingSession";
import { useRotatingRoomSetup } from "@/hooks/useRotatingRoomSetup";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import { ROULETTE_AUTOMATION_INITIAL_BANK } from "@/lib/back-office/rouletteAutomationSim";
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
  const { state, config } = useRouletteAutomationSim();
  const { tableIds, histories } = useRotatingRoomSetup();
  const lobbySession = useAutomationAlignedRotativaSession(tableIds, histories, {
    observeOnly: true,
  });

  const displayBalance = officialBalance ?? state.balance;
  const net = displayBalance - initialCapital;
  const netPct = initialCapital > 0 ? (net / initialCapital) * 100 : 0;

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
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-text-primary sm:text-4xl">
            {money(displayBalance)}
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
            {t("overview.automation.globalBank", {
              amount: money(initialCapital),
            })}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-2 p-3">
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
  );
}
