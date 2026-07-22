import type { BackOfficeModuleId } from "@/lib/back-office/navigation";
import { getBackOfficeGroup, getBackOfficeModule } from "@/lib/back-office/navigation";
import { isAdminUser, isBackOfficeAdminModule } from "@/lib/back-office/admin-access";
import { getSession } from "@/lib/auth/session";
import { BackOfficeCompanyFinancialPanel } from "@/components/back-office/back-office-company-financial-panel";
import { BackOfficeAdminNotificationsPanel } from "@/components/back-office/back-office-admin-notifications-panel";
import { BackOfficeAutomationConfigPanel } from "@/components/back-office/back-office-automation-config-panel";
import { BackOfficeAutomationStatsPanel } from "@/components/back-office/back-office-automation-stats-panel";
import { BackOfficeSequenciasMonitorPanel } from "@/components/back-office/back-office-sequencias-monitor-panel";
import { BackOfficeFootballBlitzHistoryPanel } from "@/components/back-office/back-office-football-blitz-history-panel";
import { BackOfficeClientManagement } from "@/components/back-office/back-office-client-management";
import { BackOfficePaymentGatewayPanel } from "@/components/back-office/back-office-payment-gateway-panel";
import { BackOfficePackagesPanel } from "@/components/back-office/back-office-packages-panel";
import { BackOfficeSubscriptionsPanel } from "@/components/back-office/back-office-subscriptions-panel";
import { BackOfficeAffiliatesPanel } from "@/components/back-office/back-office-affiliates-panel";
import { BackOfficeDepositsPanel } from "@/components/back-office/back-office-deposits-panel";
import { BackOfficeGlobalAutomationPanel } from "@/components/back-office/back-office-global-automation-panel";
import { BackOfficeLedgerPanel } from "@/components/back-office/back-office-ledger-panel";
import { BackOfficeTeamBonusPanel } from "@/components/back-office/back-office-team-bonus-panel";
import { BackOfficeWalletPanel } from "@/components/back-office/back-office-wallet-panel";
import { BackOfficeWithdrawalsPanel } from "@/components/back-office/back-office-withdrawals-panel";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { navGroupLabel, navModuleLabel } from "@/lib/i18n/messages";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="theme-card rounded-2xl p-5">
      <h2 className="text-sm font-bold text-text-primary">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800/80">
      <table className="w-full min-w-[320px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] uppercase tracking-wide text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-800/60 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-slate-300 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModuleBody({ moduleId }: { moduleId: BackOfficeModuleId }) {
  const { t, messages } = useI18n();

  switch (moduleId) {
    case "pacotes":
      return <BackOfficePackagesPanel />;

    case "afiliados":
      return <BackOfficeAffiliatesPanel />;

    case "rede-binaria":
      return null;

    case "bonus-equipe":
      return <BackOfficeTeamBonusPanel />;

    case "mensalidades":
      return <BackOfficeSubscriptionsPanel />;

    case "operacoes":
      return null;

    case "carteira":
      return <BackOfficeWalletPanel />;

    case "depositos":
      return <BackOfficeDepositsPanel />;

    case "saques":
      return <BackOfficeWithdrawalsPanel />;

    case "extrato":
      return <BackOfficeLedgerPanel />;

    case "automacao-global":
      return <BackOfficeGlobalAutomationPanel />;

    case "relatorios-rede":
      return (
        <Section title={t("network.reports.directTitle")}>
          <DataTable
            headers={[
              t("network.reports.colAffiliate"),
              t("network.reports.colPackage"),
              t("network.reports.colStatus"),
            ]}
            rows={messages.demo.reports.directRows}
          />
        </Section>
      );

    case "central-qualificacao":
      return (
        <Section title={t("network.qualHub.title")}>
          <DataTable
            headers={[t("network.qualHub.colIndicator"), t("network.qualHub.colValue")]}
            rows={messages.demo.qualHub.rows}
          />
        </Section>
      );

    case "automacao-config":
      return <BackOfficeAutomationConfigPanel />;

    case "automacao-estatisticas":
      return <BackOfficeAutomationStatsPanel />;

    case "automacao-sequencias":
      return <BackOfficeSequenciasMonitorPanel />;

    case "automacao-football-blitz":
      return <BackOfficeFootballBlitzHistoryPanel />;

    case "painel-financeiro":
      return <BackOfficeCompanyFinancialPanel />;

    case "gestao-clientes":
      return <BackOfficeClientManagement />;

    case "admin":
      return (
        <div className="space-y-6">
          <BackOfficePaymentGatewayPanel />
          <BackOfficeAdminNotificationsPanel />
        </div>
      );

    case "auditoria":
      return (
        <Section title={t("network.audit.title")}>
          <DataTable
            headers={[
              t("network.audit.colDateTime"),
              t("network.audit.colActor"),
              t("network.audit.colAction"),
              t("network.audit.colDetail"),
            ]}
            rows={messages.demo.audit.rows}
          />
        </Section>
      );

    default:
      return null;
  }
}

type Props = { moduleId: string };

export function BackOfficeModulePage({ moduleId }: Props) {
  const { t, messages } = useI18n();
  const mod = getBackOfficeModule(moduleId);

  if (!mod || moduleId === "visao-geral") {
    return null;
  }

  if (isBackOfficeAdminModule(mod.id) && !isAdminUser(getSession()?.user)) {
    return <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>;
  }

  const Icon = mod.icon;
  const group = getBackOfficeGroup(mod.groupId);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div>
          {group ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/80">
              {navGroupLabel(messages, group.id)}
            </p>
          ) : null}
          <h2 className="mt-1 text-xl font-bold text-white">{navModuleLabel(messages, mod.id)}</h2>
        </div>
      </div>

      <ModuleBody moduleId={mod.id} />
    </div>
  );
}
