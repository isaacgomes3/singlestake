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
import { MOCK_BACK_OFFICE_OVERVIEW, formatBrl } from "@/lib/back-office/mock-data";
import type { BackOfficeOverview } from "@/lib/back-office/types";
import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";
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
        aria-label="Resumo financeiro"
      >
        <SummaryCard
          tone="blue"
          icon={DollarSign}
          value={formatBrl(o.availableBalance)}
          label="Saldo disponível para saque"
        />
        <SummaryCard
          tone="green"
          icon={DollarSign}
          value={formatBrl(o.accumulatedEarnings)}
          label="Ganhos de rede acumulados"
        />
        <SummaryCard
          tone="teal"
          icon={DollarSign}
          value={formatBrl(auto.displayBalance)}
          label="Saldo automação (sua base)"
        />
      </section>
      <p className="-mt-4 text-xs text-text-secondary">
        {auto.hasStartPack ? (
          <>
            Pack Start {formatBrl(START_PACKAGE_AMOUNT)} activo · base de automação{" "}
            {formatBrl(auto.investedBase)} (múltiplos de {formatBrl(AUTOMATION_DEPOSIT_STEP)}).
            Rendimento diário só sobre a parte de automação
            {auto.earnedOnBase > 0 ? (
              <>
                {" "}
                · ganhos {formatBrl(auto.earnedOnBase)}
                {autoNet !== 0 ? ` (${autoPct >= 0 ? "+" : ""}${autoPct.toFixed(2)}%)` : null}
              </>
            ) : null}
            .
          </>
        ) : (
          <>
            Requer Pack Start {formatBrl(START_PACKAGE_AMOUNT)}. Depósitos de automação em múltiplos
            de {formatBrl(AUTOMATION_DEPOSIT_STEP)}; o rendimento incide apenas sobre essa base.
          </>
        )}
      </p>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Automação global · igual para todos os utilizadores
        </p>
        <RouletteAutomationSimulatorPanel />
      </section>

      <section>
        <AutomationHistoryTable rounds={globalAutomation.rounds} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="theme-card flex min-h-[140px] flex-col justify-between bg-accent-education px-6 py-5 text-kpi-foreground">
          <div>
            <p className="text-lg font-semibold">Casino ao vivo</p>
            <p className="mt-1 text-sm opacity-85">Roletas, sala rotativa e indicações 1 Fator.</p>
          </div>
          <Link
            to={BACK_OFFICE_PATHS.casinoAoVivo}
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-md bg-accent-cta px-8 py-2.5 text-sm font-bold uppercase tracking-wide text-kpi-foreground shadow-md transition hover:bg-accent-cta-hover"
          >
            <Gamepad2 className="h-4 w-4" aria-hidden />
            Ver roletas
          </Link>
        </div>

        <div className="theme-card bg-accent-referral px-6 py-5 text-kpi-foreground">
          <p className="text-lg font-semibold">Link de Divulgação</p>
          <p className="mt-1 text-sm opacity-85">Partilhe o seu link de indicação.</p>
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
