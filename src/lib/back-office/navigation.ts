import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  ClipboardList,
  Coins,
  FileText,
  GitBranch,
  LayoutDashboard,
  Link2,
  Network,
  Package,
  Percent,
  ScrollText,
  Shield,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  Headphones,
  Zap,
} from "lucide-react";

export type BackOfficeModuleId =
  | "visao-geral"
  | "pacotes"
  | "afiliados"
  | "rede-binaria"
  | "bonus-equipe"
  | "mensalidades"
  | "residual"
  | "operacoes"
  | "carteira"
  | "depositos"
  | "saques"
  | "extrato"
  | "automacao-global"
  | "relatorios-rede"
  | "central-qualificacao"
  | "admin"
  | "automacao-config"
  | "automacao-estatisticas"
  | "auditoria"
  | "casino-ao-vivo";

export type BackOfficeGroupId =
  | "produtos"
  | "rede"
  | "operacoes"
  | "financeiro"
  | "administracao";

export type BackOfficeSuporteItem = {
  id: "suporte";
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
};

export const BACK_OFFICE_SUPORTE: BackOfficeSuporteItem = {
  id: "suporte",
  label: "Suporte",
  path: "/back-office/suporte",
  icon: Headphones,
  description: "Canal de ajuda, contacto e tickets de suporte.",
};

export type BackOfficeGroupSection = {
  key: string;
  moduleIds: BackOfficeModuleId[];
};

export type BackOfficeNavItem = {
  id: BackOfficeModuleId;
  label: string;
  path: string;
  icon: LucideIcon;
  groupId: BackOfficeGroupId | "principal";
  description: string;
};

export type BackOfficeGroup = {
  id: BackOfficeGroupId;
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
  moduleIds: BackOfficeModuleId[];
};

export const BACK_OFFICE_GROUPS: BackOfficeGroup[] = [
  {
    id: "produtos",
    label: "Produtos",
    path: "/back-office/produtos",
    icon: Package,
    description: "Pacotes e mensalidades.",
    moduleIds: ["pacotes", "mensalidades"],
  },
  {
    id: "rede",
    label: "Rede",
    path: "/back-office/rede",
    icon: Network,
    description: "Afiliados, binário e bônus de equipe.",
    moduleIds: ["afiliados", "rede-binaria", "bonus-equipe"],
  },
  {
    id: "operacoes",
    label: "Operações",
    path: "/back-office/operacoes",
    icon: BarChart3,
    description: "Casino ao vivo e sala rotativa.",
    moduleIds: ["casino-ao-vivo"],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    path: "/back-office/financeiro",
    icon: Wallet,
    description: "Carteira, depósitos, saques e extrato.",
    moduleIds: ["carteira", "depositos", "saques", "extrato"],
  },
  {
    id: "administracao",
    label: "Administração",
    path: "/back-office/administracao",
    icon: Shield,
    description: "Automação global, painel admin e auditoria.",
    moduleIds: ["automacao-config", "automacao-estatisticas", "admin", "auditoria"],
  },
];

export const OPERACOES_SECTIONS: BackOfficeGroupSection[] = [];

export const ADMINISTRACAO_SECTIONS: BackOfficeGroupSection[] = [
  {
    key: "automacao",
    moduleIds: ["automacao-config", "automacao-estatisticas"],
  },
  {
    key: "gestao",
    moduleIds: ["admin", "auditoria"],
  },
];

const MODULE_META: Record<
  Exclude<BackOfficeModuleId, "visao-geral">,
  Omit<BackOfficeNavItem, "id" | "path" | "groupId">
> = {
  pacotes: {
    label: "Pacotes",
    icon: Package,
    description: "Cadastro e gestão de planos de investimento.",
  },
  mensalidades: {
    label: "Mensalidades",
    icon: Coins,
    description: "Assinaturas, renovação e suspensão de ganhos.",
  },
  residual: {
    label: "Residual mensalidade",
    icon: Percent,
    description: "Pagamentos recorrentes em até 10 níveis.",
  },
  afiliados: {
    label: "Afiliados",
    icon: Link2,
    description: "Indicação direta e indireta até 5 níveis.",
  },
  "rede-binaria": {
    label: "Rede binária",
    icon: GitBranch,
    description: "Estrutura binária, pontos, bônus e árvore genealógica.",
  },
  "bonus-equipe": {
    label: "Bônus de equipe",
    icon: Users,
    description: "Bônus por volume, activos na rede e residual de mensalidade (10 níveis).",
  },
  operacoes: {
    label: "Participação operações",
    icon: BarChart3,
    description: "Comissões sobre volume operado dos afiliados.",
  },
  carteira: {
    label: "Carteira",
    icon: Wallet,
    description: "Saldos separados por origem de bônus.",
  },
  depositos: {
    label: "Depósitos",
    icon: ArrowDownToLine,
    description: "PIX, cripto e aprovações.",
  },
  saques: {
    label: "Saques",
    icon: ArrowUpFromLine,
    description: "Regras, taxas e aprovação de retiradas.",
  },
  extrato: {
    label: "Extrato",
    icon: FileText,
    description: "Livro razão financeiro completo.",
  },
  "automacao-global": {
    label: "Automação global",
    icon: Zap,
    description: "Saldo operacional compartilhado da roleta e histórico de transações.",
  },
  "relatorios-rede": {
    label: "Relatórios de rede",
    icon: Network,
    description: "Rede direta, indireta e volume.",
  },
  "central-qualificacao": {
    label: "Central qualificação",
    icon: ClipboardList,
    description: "Acompanhamento de graduação do afiliado.",
  },
  "automacao-config": {
    label: "Automação global",
    icon: Zap,
    description: "Stake inicial, pausa manual e rendimento diário dos pacotes.",
  },
  "automacao-estatisticas": {
    label: "Estatísticas automação",
    icon: Percent,
    description: "Percentual de acerto por gatilho 1 Fator.",
  },
  admin: {
    label: "Painel administrativo",
    icon: UserCog,
    description: "Utilizadores, gateway PIX, notificações e activações.",
  },
  auditoria: {
    label: "Auditoria e logs",
    icon: ScrollText,
    description: "Registro de bônus, alterações e logins.",
  },
  "casino-ao-vivo": {
    label: "Cassino ao vivo",
    icon: Sparkles,
    description: "Roletas ao vivo e sala rotativa 1 fator.",
  },
};

function modulePath(groupId: BackOfficeGroupId, moduleId: BackOfficeModuleId): string {
  return `/back-office/${groupId}/${moduleId}`;
}

export const BACK_OFFICE_NAV: BackOfficeNavItem[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    path: "/back-office",
    icon: LayoutDashboard,
    groupId: "principal",
    description: "Painel com visão geral do negócio e indicadores financeiros.",
  },
  ...BACK_OFFICE_GROUPS.flatMap((group) =>
    group.moduleIds.map((moduleId) => ({
      id: moduleId,
      ...MODULE_META[moduleId],
      path: modulePath(group.id, moduleId),
      groupId: group.id,
    })),
  ),
];

export const BACK_OFFICE_MODULE_IDS = new Set(
  BACK_OFFICE_NAV.map((item) => item.id),
);

export const BACK_OFFICE_GROUP_IDS = new Set(
  BACK_OFFICE_GROUPS.map((group) => group.id),
);

export function getBackOfficeModule(id: string): BackOfficeNavItem | undefined {
  return BACK_OFFICE_NAV.find((m) => m.id === id);
}

export function getBackOfficeGroup(id: string): BackOfficeGroup | undefined {
  return BACK_OFFICE_GROUPS.find((g) => g.id === id);
}

export function getGroupForModule(moduleId: BackOfficeModuleId): BackOfficeGroup | undefined {
  return BACK_OFFICE_GROUPS.find((g) => g.moduleIds.includes(moduleId));
}

export function getModulesForGroup(groupId: BackOfficeGroupId): BackOfficeNavItem[] {
  const group = getBackOfficeGroup(groupId);
  if (!group) return [];
  return group.moduleIds
    .map((id) => getBackOfficeModule(id))
    .filter((m): m is BackOfficeNavItem => m != null);
}

/** Itens do menu lateral: visão geral + grupos + suporte. */
export function backOfficeSidebarNav(): Array<
  | { kind: "overview"; item: BackOfficeNavItem }
  | { kind: "group"; item: BackOfficeGroup }
  | { kind: "suporte"; item: BackOfficeSuporteItem }
> {
  const overview = BACK_OFFICE_NAV.find((m) => m.id === "visao-geral");
  if (!overview) {
    return [
      ...BACK_OFFICE_GROUPS.map((item) => ({ kind: "group" as const, item })),
      { kind: "suporte", item: BACK_OFFICE_SUPORTE },
    ];
  }
  return [
    { kind: "overview", item: overview },
    ...BACK_OFFICE_GROUPS.map((item) => ({ kind: "group" as const, item })),
    { kind: "suporte", item: BACK_OFFICE_SUPORTE },
  ];
}

export function isGroupActive(pathname: string, group: BackOfficeGroup): boolean {
  return (
    pathname === group.path ||
    pathname.startsWith(`${group.path}/`) ||
    group.moduleIds.some((id) => {
      const mod = getBackOfficeModule(id);
      return mod != null && pathname === mod.path;
    })
  );
}

export function getGroupSections(
  groupId: BackOfficeGroupId,
): BackOfficeGroupSection[] | null {
  if (groupId === "administracao") return ADMINISTRACAO_SECTIONS;
  if (groupId === "operacoes" && OPERACOES_SECTIONS.length > 0) return OPERACOES_SECTIONS;
  return null;
}

/** @deprecated Use backOfficeSidebarNav */
export function backOfficeNavGroups(): { group: string; items: BackOfficeNavItem[] }[] {
  return BACK_OFFICE_GROUPS.map((g) => ({
    group: g.label,
    items: getModulesForGroup(g.id),
  }));
}
