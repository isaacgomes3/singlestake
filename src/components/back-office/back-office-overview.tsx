import { DollarSign } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { BackOfficeCasinoContent } from "@/components/back-office/back-office-casino-content";
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section
        className="grid items-stretch gap-4 sm:grid-cols-2"
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
      </section>

      <section aria-label={t("overview.casinoTitle")}>
        <div className="mb-3">
          <h2 className="text-sm font-bold text-text-primary">{t("overview.casinoTitle")}</h2>
          <p className="mt-0.5 text-xs text-text-secondary">{t("overview.casinoDesc")}</p>
        </div>
        <DeferredMount delayMs={50}>
          <BackOfficeCasinoContent />
        </DeferredMount>
      </section>
    </div>
  );
}
