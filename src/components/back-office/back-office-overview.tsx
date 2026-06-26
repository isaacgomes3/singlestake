import { Link } from "@tanstack/react-router";
import { DollarSign, Gamepad2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AutomationHistoryTable } from "@/components/back-office/automation-history-table";
import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { RouletteAutomationSimulatorPanel } from "@/components/back-office/roulette-automation-simulator-panel";
import { AUTOMATION_DEPOSIT_STEP, START_PACKAGE_AMOUNT } from "@/lib/back-office/product-constants";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import { apiFetchOverview } from "@/lib/auth/api";
import { getSession } from "@/lib/auth/session";
import { MOCK_BACK_OFFICE_OVERVIEW } from "@/lib/back-office/mock-data";
import type { BackOfficeOverview } from "@/lib/back-office/types";
import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";
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
        "flex min-h-[120px] items-center gap-4 rounded-2xl px-5 py-4 text-kpi-foreground",
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
  const { state: globalAutomation } = useRouletteAutomationSim();

  useEffect(() => {
    void apiFetchOverview().then((data) => {
      setOverview(data ?? MOCK_BACK_OFFICE_OVERVIEW);
    });
  }, []);

  const o = overview ?? MOCK_BACK_OFFICE_OVERVIEW;
  const sessionUser = getSession()?.user;
  const auto = o.automation;
  const autoNet = auto.displayBalance - auto.investedBase;
  const autoPct = auto.investedBase > 0 ? (autoNet / auto.investedBase) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
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
        <SummaryCard
          tone="teal"
          icon={DollarSign}
          value={money(auto.displayBalance)}
          label={t("overview.kpiAutomation")}
        />
      </section>
      <p className="-mt-4 text-xs text-text-secondary">
        {auto.hasStartPack ? (
          <>
            {t("overview.startActive", {
              start: money(START_PACKAGE_AMOUNT),
              base: money(auto.investedBase),
              step: money(AUTOMATION_DEPOSIT_STEP),
            })}
            {auto.earnedOnBase > 0 ? (
              <>
                {t("overview.startEarnings", { earned: money(auto.earnedOnBase) })}
                {autoNet !== 0 ? ` (${autoPct >= 0 ? "+" : ""}${autoPct.toFixed(2)}%)` : null}
              </>
            ) : null}
            .
          </>
        ) : (
          t("overview.startRequired", {
            start: money(START_PACKAGE_AMOUNT),
            step: money(AUTOMATION_DEPOSIT_STEP),
          })
        )}
      </p>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {t("overview.globalAutomation")}
        </p>
        <RouletteAutomationSimulatorPanel />
      </section>

      <section>
        <AutomationHistoryTable rounds={globalAutomation.rounds} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="theme-card flex min-h-[140px] flex-col justify-between bg-accent-education px-6 py-5 text-kpi-foreground">
          <div>
            <p className="text-lg font-semibold">{t("overview.casinoTitle")}</p>
            <p className="mt-1 text-sm opacity-85">{t("overview.casinoDesc")}</p>
          </div>
          <Link
            to={BACK_OFFICE_PATHS.casinoAoVivo}
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-md bg-accent-cta px-8 py-2.5 text-sm font-bold uppercase tracking-wide text-kpi-foreground shadow-md transition hover:bg-accent-cta-hover"
          >
            <Gamepad2 className="h-4 w-4" aria-hidden />
            {t("overview.casinoCta")}
          </Link>
        </div>

        <div className="theme-card bg-accent-referral px-6 py-5 text-kpi-foreground">
          <p className="text-lg font-semibold">{t("overview.referralTitle")}</p>
          <p className="mt-1 text-sm opacity-85">{t("overview.referralDesc")}</p>
          <div className="mt-4 [&_input]:border-0 [&_input]:bg-bg-secondary [&_input]:text-text-primary">
            {sessionUser?.referralCode ? (
              <ReferralLinkField
                referralCode={sessionUser.referralCode}
                referralLink={o.referralLink || sessionUser.referralLink}
              />
            ) : (
              <ReferralLinkField referralCode="…" referralLink={o.referralLink} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
