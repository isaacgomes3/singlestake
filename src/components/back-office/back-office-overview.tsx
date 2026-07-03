import { Link } from "@tanstack/react-router";
import { ChevronRight, DollarSign, GitBranch } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AutomationGlobalKpiCard } from "@/components/back-office/automation-global-kpi-card";
import { AutomationOverviewSections } from "@/components/back-office/automation-overview-sections";
import { DeferredMount } from "@/components/deferred-mount";
import { useBackOfficeFinancePoll } from "@/hooks/useBackOfficeFinancePoll";
import { apiFetchOverview } from "@/lib/auth/api";
import { MOCK_BACK_OFFICE_OVERVIEW } from "@/lib/back-office/mock-data";
import type { BackOfficeOverview } from "@/lib/back-office/types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

function SummaryCard({
  tone,
  icon: Icon,
  value,
  label,
}: {
  tone: "green" | "blue" | "teal" | "slate";
  icon: typeof DollarSign;
  value: string;
  label: string;
}) {
  const bg =
    tone === "green"
      ? "bg-kpi-green"
      : tone === "blue"
        ? "bg-kpi-blue"
        : tone === "teal"
          ? "bg-kpi-teal"
          : "bg-kpi-slate";

  const glow =
    tone === "green"
      ? "shadow-[0_8px_28px_rgba(52,168,83,0.38)]"
      : tone === "blue"
        ? "shadow-[0_8px_28px_rgba(51,122,183,0.38)]"
        : tone === "teal"
          ? "shadow-[0_8px_28px_rgba(31,182,143,0.38)]"
          : "shadow-md";

  return (
    <div
      className={cn(
        "flex h-full min-h-[120px] items-center gap-4 rounded-2xl px-5 py-4 text-kpi-foreground",
        bg,
        glow,
      )}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase leading-snug tracking-wide opacity-90">
          {label}
        </p>
      </div>
    </div>
  );
}

export function BackOfficeOverviewPage() {
  const { t } = useI18n();
  const { money } = useFormat();
  const [overview, setOverview] = useState<BackOfficeOverview | null>(null);

  const reload = useCallback(async () => {
    const data = await apiFetchOverview();
    setOverview(data ?? MOCK_BACK_OFFICE_OVERVIEW);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useBackOfficeFinancePoll(() => {
    void reload();
  });

  const o = overview ?? MOCK_BACK_OFFICE_OVERVIEW;
  const auto = o.automation;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section
        className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={t("overview.financialSummary")}
      >
        <SummaryCard
          tone="blue"
          icon={DollarSign}
          value={money(o.availableBalance)}
          label={t("overview.kpiAvailable")}
        />
        <SummaryCard
          tone="green"
          icon={DollarSign}
          value={money(o.accumulatedEarnings)}
          label={t("overview.kpiNetwork")}
        />
        <Link
          to="/back-office/financeiro/carteira"
          className="block h-full rounded-2xl transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <SummaryCard
            tone="teal"
            icon={DollarSign}
            value={money(auto.displayBalance)}
            label={t("overview.kpiAutomation")}
          />
        </Link>
        <AutomationGlobalKpiCard />
      </section>

      <DeferredMount delayMs={50}>
        <AutomationOverviewSections />
      </DeferredMount>

      <section>
        <Link
          to="/back-office/rede/rede-binaria"
          className="theme-card flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-bg-card-hover"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <GitBranch className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-text-primary">
              {t("overview.binaryTreeLinkTitle")}
            </span>
            <span className="block text-xs text-text-secondary">
              {t("overview.binaryTreeLinkDesc")}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
