import { useMemo } from "react";

import {
  globalAutomationOpeningBalance,
} from "@/lib/back-office/rouletteAutomationSim";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

type ValueTone = "default" | "green" | "red";

function valueToneFromNumber(n: number): ValueTone {
  if (n > 0) return "green";
  if (n < 0) return "red";
  return "default";
}

function valueToneClasses(valueTone: ValueTone) {
  switch (valueTone) {
    case "green":
      return "text-emerald-400";
    case "red":
      return "text-red-400";
    default:
      return "text-kpi-foreground";
  }
}

function GlobalKpiMiniButton({
  label,
  value,
  compactValue,
  valueTone = "default",
}: {
  label: string;
  value: string;
  compactValue?: boolean;
  valueTone?: ValueTone;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center rounded-xl bg-kpi-slate px-2 py-2 text-center text-kpi-foreground shadow-md",
      )}
    >
      <span
        className={cn(
          "max-w-full truncate font-bold tabular-nums leading-none",
          compactValue ? "text-sm sm:text-base" : "text-base sm:text-lg",
          valueToneClasses(valueTone),
        )}
      >
        {value}
      </span>
      <span className="mt-1.5 text-[9px] font-semibold uppercase leading-tight tracking-wide opacity-90">
        {label}
      </span>
    </div>
  );
}

export function AutomationGlobalKpiCard() {
  const { t } = useI18n();
  const { money } = useFormat();
  const { state, config, openBet, pendingSignal } = useRouletteAutomationSim();

  const displayBalance = state.balance;
  const initialCapital = globalAutomationOpeningBalance(state);
  const net = displayBalance - initialCapital;
  const netPct = initialCapital > 0 ? (net / initialCapital) * 100 : 0;
  const isPaused = config?.blocksNewEntries === true;
  const activePlay = openBet ?? pendingSignal;

  const statusValue = activePlay
    ? t("overview.globalKpiCard.inPlayWithTable", { table: activePlay.tableLabel })
    : isPaused
      ? t("overview.globalKpiCard.paused")
      : t("overview.globalKpiCard.waiting");

  const statusTone: ValueTone = activePlay ? "green" : isPaused ? "default" : "default";

  const netFormatted = money(net);
  const pctFormatted = `${netPct.toFixed(2)}%`;
  const balanceFormatted = money(displayBalance);

  const items = useMemo(
    () => [
      {
        label: t("overview.globalKpiCard.balance"),
        value: balanceFormatted,
        compactValue: balanceFormatted.length > 12,
        valueTone: "default" as const,
      },
      {
        label: t("overview.globalKpiCard.net"),
        value: netFormatted,
        compactValue: netFormatted.length > 12,
        valueTone: valueToneFromNumber(net),
      },
      {
        label: t("overview.globalKpiCard.variation"),
        value: pctFormatted,
        valueTone: valueToneFromNumber(netPct),
      },
      {
        label: t("overview.globalKpiCard.status"),
        value: statusValue,
        compactValue: statusValue.length > 14,
        valueTone: statusTone,
      },
    ],
    [balanceFormatted, netFormatted, pctFormatted, statusTone, statusValue, t],
  );

  return (
    <div
      className="grid h-full min-h-[120px] grid-cols-2 grid-rows-2 gap-1.5"
      aria-label={t("overview.globalKpiCard.title")}
    >
      {items.map((item) => (
        <GlobalKpiMiniButton
          key={item.label}
          label={item.label}
          value={item.value}
          compactValue={item.compactValue}
          valueTone={item.valueTone}
        />
      ))}
    </div>
  );
}
