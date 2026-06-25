import {
  DEFAULT_PACKAGES,
} from "@/lib/back-office/constants";
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
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="theme-card rounded-2xl p-5">
      <h2 className="text-sm font-bold text-text-primary">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc space-y-1 text-sm text-text-secondary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
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
  switch (moduleId) {
    case "pacotes":
      return <BackOfficePackagesPanel />;

    case "rendimentos":
      return (
        <div className="space-y-5">
          <Section title="Controle do motor diário">
            <BulletList
              items={[
                "Percentual diário por pacote",
                "Limite máximo diário e controle de teto",
                "Histórico de créditos e logs de processamento",
                "Relatórios: ganhos por dia, pacote e usuário",
              ]}
            />
          </Section>
          <Section title="Último processamento (demo)">
            <DataTable
              headers={["Data", "Pacote", "Créditos", "Status"]}
              rows={[
                ["24/06/2026", "Bronze", "R$ 6,00", "OK"],
                ["24/06/2026", "Prata", "R$ 15,00", "OK"],
                ["24/06/2026", "Ouro", "R$ 90,00", "OK"],
              ]}
            />
          </Section>
        </div>
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
      return (
        <Section title="Participação sobre operações">
          <BulletList
            items={[
              "Volume operado e lucro gerado por afiliado",
              "Comissão gerada para patrocinadores",
              "Relatórios por usuário e por rede",
            ]}
          />
        </Section>
      );

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
        <div className="space-y-5">
          <Section title="Rede directa">
            <DataTable
              headers={["Afiliado", "Pacote", "Status"]}
              rows={[
                ["Maria Silva", "Prata", "Activo"],
                ["João Costa", "Bronze", "Activo"],
                ["Ana Lima", "—", "Pendente"],
              ]}
            />
          </Section>
          <Section title="Rede indirecta">
            <p className="text-sm text-slate-400">
              Estrutura completa, profundidade e volume por nível.
            </p>
          </Section>
        </div>
      );

    case "central-qualificacao":
      return (
        <Section title="Central de qualificação (afiliado)">
          <DataTable
            headers={["Indicador", "Valor"]}
            rows={[
              ["Qualificadores directos", "3 / 5"],
              ["Próxima graduação", "Ouro"],
              ["Volume esquerdo", "R$ 42.000"],
              ["Volume direito", "R$ 38.200"],
              ["Equipe activa", "47"],
            ]}
          />
        </Section>
      );

    case "admin":
      return <BackOfficeAdminUsersPanel />;

    case "auditoria":
      return (
        <Section title="Auditoria e logs">
          <DataTable
            headers={["Data/hora", "Actor", "Acção", "Detalhe"]}
            rows={[
              ["24/06 09:00", "sistema", "rendimento_diario", "142 créditos"],
              ["24/06 10:15", "admin", "aprovar_saque", "user #1042"],
              ["24/06 11:02", "user #88", "login", "IP 189.x.x.x"],
            ]}
          />
          <BulletList
            items={[
              "Quem recebeu e quem pagou cada bônus",
              "Alterações administrativas",
              "Logins e solicitações financeiras",
            ]}
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
  const mod = getBackOfficeModule(moduleId);

  if (!mod || moduleId === "visao-geral") {
    return null;
  }

  const Icon = mod.icon;
  const groupLabel = getBackOfficeGroup(mod.groupId)?.label;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div>
          {groupLabel ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400/80">
              {groupLabel}
            </p>
          ) : null}
          <h2 className="mt-1 text-xl font-bold text-white">{mod.label}</h2>
          <p className="mt-2 text-sm text-slate-400">{mod.description}</p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/85",
        )}
      >
        Interface administrativa pronta para integração com API e banco de dados (
        <code className="text-amber-200/90">users</code>, <code className="text-amber-200/90">packages</code>,{" "}
        <code className="text-amber-200/90">wallets</code>, <code className="text-amber-200/90">binary_tree</code>, etc.).
      </div>

      <ModuleBody moduleId={mod.id} />
    </div>
  );
}
