import { useEffect, useMemo, useState } from "react";

import {
  fetchGlobalAutomationFinance,
  type GlobalAutomationFinance,
} from "@/lib/back-office/global-automation-api";
import { ROULETTE_AUTOMATION_INITIAL_BANK } from "@/lib/back-office/rouletteAutomationSim";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

type Tone = "green" | "blue" | "teal" | "slate";

function toneClasses(tone: Tone) {
  switch (tone) {
    case "green":
      return "bg-kpi-green shadow-[0_4px_16px_rgba(52,168,83,0.32)]";
    case "blue":
      return "bg-kpi-blue shadow-[0_4px_16px_rgba(51,122,183,0.32)]";
    case "teal":
      return "bg-kpi-teal shadow-[0_4px_16px_rgba(31,182,143,0.32)]";
    default:
      return "bg-kpi-slate shadow-md";
  }
}

function GlobalKpiMiniButton({
  tone,
  label,
  value,
  compactValue,
}: {
  tone: Tone;
  label: string;
  value: string;
  compactValue?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-kpi-foreground",
        toneClasses(tone),
      )}
    >
      <span
        className={cn(
          "max-w-full truncate font-bold tabular-nums leading-none",
          compactValue ? "text-sm sm:text-base" : "text-base sm:text-lg",
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
  const { state, config, revision } = useRouletteAutomationSim();
  const [finance, setFinance] = useState<GlobalAutomationFinance | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchGlobalAutomationFinance().then(({ finance: data }) => {
      if (!cancelled) setFinance(data);
    });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const displayBalance = finance?.balance ?? state.balance;
  const initialCapital = finance?.initialCapital ?? ROULETTE_AUTOMATION_INITIAL_BANK;
  const net = displayBalance - initialCapital;
  const netPct = initialCapital > 0 ? (net / initialCapital) * 100 : 0;
  const isPaused = config?.blocksNewEntries === true;

  const statusValue = isPaused
    ? t("overview.globalKpiCard.paused")
    : t("overview.globalKpiCard.waiting");

  const netFormatted = `${net >= 0 ? "+" : ""}${money(net)}`;
  const pctFormatted = `${netPct >= 0 ? "+" : ""}${netPct.toFixed(2)}%`;
  const balanceFormatted = money(displayBalance);

  const items = useMemo(
    () => [
      {
        tone: "teal" as const,
        label: t("overview.globalKpiCard.balance"),
        value: balanceFormatted,
        compactValue: balanceFormatted.length > 12,
      },
      {
        tone: net >= 0 ? ("green" as const) : ("slate" as const),
        label: t("overview.globalKpiCard.net"),
        value: netFormatted,
        compactValue: netFormatted.length > 12,
      },
      {
        tone: "blue" as const,
        label: t("overview.globalKpiCard.variation"),
        value: pctFormatted,
      },
      {
        tone: "slate" as const,
        label: t("overview.globalKpiCard.status"),
        value: statusValue,
      },
    ],
    [balanceFormatted, net, netFormatted, pctFormatted, statusValue, t],
  );

  return (
    <div
      className="grid h-full min-h-[120px] grid-cols-2 grid-rows-2 gap-1.5"
      aria-label={t("overview.globalKpiCard.title")}
    >
      {items.map((item) => (
        <GlobalKpiMiniButton
          key={item.label}
          tone={item.tone}
          label={item.label}
          value={item.value}
          compactValue={item.compactValue}
        />
      ))}
    </div>
  );
}
