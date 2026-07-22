import { Link } from "@tanstack/react-router";
import { ExternalLink, Lock, Search, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BackOfficeCasinoContent, useLobbyAnalyzerCount } from "@/components/back-office/back-office-casino-content";
import { DeferredMount } from "@/components/deferred-mount";
import { useBackOfficeFinancePoll } from "@/hooks/useBackOfficeFinancePoll";
import { apiFetchOverview } from "@/lib/auth/api";
import { MIN_DEPOSIT_AMOUNT } from "@/lib/back-office/finance-constants";
import { MOCK_BACK_OFFICE_OVERVIEW } from "@/lib/back-office/mock-data";
import type { BackOfficeOverview } from "@/lib/back-office/types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";
import { setStrategySoundSuppressed } from "@/lib/sound/strategySoundGate";
import { cn } from "@/lib/utils";

const ANALYZER_ACCESS_MIN = MIN_DEPOSIT_AMOUNT;
const DEPOSIT_PATH = "/back-office/financeiro/depositos";

export function BackOfficeOverviewPage() {
  const { t } = useI18n();
  const { money } = useFormat();
  const [overview, setOverview] = useState<BackOfficeOverview | null>(null);
  const [query, setQuery] = useState("");
  const analyzerCount = useLobbyAnalyzerCount(query);

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

  /** Lobby de roletas: sem efeitos sonoros de sinal/placar. */
  useEffect(() => {
    setStrategySoundSuppressed(true);
    return () => setStrategySoundSuppressed(false);
  }, []);

  const o = overview ?? MOCK_BACK_OFFICE_OVERVIEW;
  const balance = Number(o.availableBalance) || 0;
  const missing = Math.max(0, ANALYZER_ACCESS_MIN - balance);
  const hasAccess = missing <= 0;

  const analyzerCountLabel = useMemo(
    () => t("overview.analyzersAvailable", { count: analyzerCount }),
    [t, analyzerCount],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t("overview.analyzersTitle")}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{analyzerCountLabel}</p>
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("overview.analyzersSearchPlaceholder")}
            className="w-full rounded-full border border-neutral-800 bg-[#141414] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 outline-none ring-[var(--brand-orange,#ff6b00)]/0 transition focus:border-[var(--brand-orange,#ff6b00)]/50 focus:ring-2 focus:ring-[var(--brand-orange,#ff6b00)]/20"
          />
        </label>
      </header>

      <div className="neon-access-frame" aria-label={t("overview.accessBarLabel")}>
        <section
          className={cn(
            "neon-access-frame__inner border p-4 sm:p-5",
            hasAccess
              ? "border-emerald-500/20 bg-emerald-950/30"
              : "border-transparent bg-gradient-to-br from-[#1a1008] to-[#0a0a0a]",
          )}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  "relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  hasAccess ? "bg-emerald-500/20 text-emerald-300" : "bg-orange-500/15 text-orange-300",
                )}
              >
                <Lock className="h-5 w-5" aria-hidden />
                {!hasAccess ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--brand-orange,#ff6b00)] ring-2 ring-black" />
                ) : null}
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold text-white">
                  {hasAccess ? t("overview.accessOkTitle") : t("overview.accessDeniedTitle")}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    hasAccess ? "text-emerald-300/90" : "text-[var(--brand-orange,#ff6b00)]",
                  )}
                >
                  {hasAccess
                    ? t("overview.accessOkBody", { balance: money(balance) })
                    : t("overview.accessDeniedBody", {
                        min: money(ANALYZER_ACCESS_MIN),
                        missing: money(missing),
                      })}
                </p>
                <p className="mt-2 rounded-xl border border-amber-500/20 bg-black/40 px-3 py-2 text-xs text-amber-200/90">
                  {t("overview.accessHint")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Link
                to={DEPOSIT_PATH}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-orange,#ff6b00)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(255,107,0,0.35)] transition hover:bg-[var(--brand-orange-glow,#ff8c00)]"
              >
                {t("overview.accessDepositCta")}
              </Link>
              <Link
                to="/back-office/produtos/pacotes"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/35 bg-[#1a1208] px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/55"
              >
                {t("overview.accessCampaignCta")}
                <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section aria-label={t("overview.analyzersSectionTitle")}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--brand-orange,#ff6b00)]" aria-hidden />
          <h2 className="text-sm font-bold text-white">{t("overview.analyzersSectionTitle")}</h2>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-bold tabular-nums text-neutral-400">
            {analyzerCount}
          </span>
        </div>
        <DeferredMount delayMs={50}>
          <BackOfficeCasinoContent searchQuery={query} />
        </DeferredMount>
      </section>
    </div>
  );
}
