import type { BackOfficeModuleId } from "@/lib/back-office/navigation";
import { getBackOfficeGroup, getBackOfficeModule } from "@/lib/back-office/navigation";
import { BackOfficeAdminUsersPanel } from "@/components/back-office/back-office-admin-users-panel";
import { BackOfficePackagesPanel } from "@/components/back-office/back-office-packages-panel";
import { BackOfficeSubscriptionsPanel } from "@/components/back-office/back-office-subscriptions-panel";
import { BackOfficeAffiliatesPanel } from "@/components/back-office/back-office-affiliates-panel";
import { BackOfficeBinaryBonusPanel } from "@/components/back-office/back-office-binary-bonus-panel";
import { BackOfficeBinaryPanel } from "@/components/back-office/back-office-binary-panel";
import { BackOfficeCasinoContent } from "@/components/back-office/back-office-casino-content";
import { BackOfficeDepositsPanel } from "@/components/back-office/back-office-deposits-panel";
import { BackOfficeLedgerPanel } from "@/components/back-office/back-office-ledger-panel";
import { BackOfficeQualificationPanel } from "@/components/back-office/back-office-qualification-panel";
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

    case "rendimentos":
      return (
        <Section title={t("products.yields.lastRunTitle")}>
          <DataTable
            headers={[
              t("shared.columns.date"),
              t("shared.columns.package"),
              t("shared.columns.credits"),
              t("products.yields.colStatus"),
            ]}
            rows={messages.demo.yields.demoRows}
          />
        </Section>
      );

    case "afiliados":
      return <BackOfficeAffiliatesPanel />;

    case "rede-binaria":
      return <BackOfficeBinaryPanel />;

    case "qualificacao":
      return <BackOfficeQualificationPanel />;

    case "bonus-binario":
      return <BackOfficeBinaryBonusPanel />;

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

    case "admin":
      return <BackOfficeAdminUsersPanel />;

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

    case "casino-ao-vivo":
    case "casino-outros-jogos":
    case "casino-simulador":
    case "casino-estatisticas":
      return (
        <BackOfficeCasinoContent
          moduleId={
            moduleId as Extract<
              BackOfficeModuleId,
              "casino-ao-vivo" | "casino-outros-jogos" | "casino-simulador" | "casino-estatisticas"
            >
          }
        />
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
