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
  valueClassName,
}: {
  tone: Tone;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[54px] flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-kpi-foreground",
        toneClasses(tone),
      )}
    >
      <span
        className={cn(
          "text-sm font-bold tabular-nums leading-none sm:text-base",
          valueClassName,
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-[8px] font-semibold uppercase leading-tight tracking-wide opacity-90">
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

  const items = useMemo(
    () => [
      {
        tone: "teal" as const,
        label: t("overview.globalKpiCard.balance"),
        value: money(displayBalance),
      },
      {
        tone: net >= 0 ? ("green" as const) : ("slate" as const),
        label: t("overview.globalKpiCard.net"),
        value: netFormatted,
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
    [displayBalance, money, net, netFormatted, pctFormatted, statusValue, t],
  );

  return (
    <div
      className="flex min-h-[120px] flex-col justify-center gap-2 rounded-2xl border border-border-color/60 bg-bg-card/40 p-2.5"
      aria-label={t("overview.globalKpiCard.title")}
    >
      <div className="flex items-center gap-1.5 px-1">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            isPaused ? "bg-warning" : "animate-pulse bg-kpi-green/80",
          )}
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          {t("overview.globalKpiCard.title")}
        </p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        {items.map((item) => (
          <GlobalKpiMiniButton
            key={item.label}
            tone={item.tone}
            label={item.label}
            value={item.value}
          />
        ))}
      </div>
    </div>
  );
}
