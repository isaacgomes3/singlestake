import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Award,
  BarChart3,
  ClipboardList,
  Coins,
  FileText,
  Gamepad2,
  GitBranch,
  LayoutDashboard,
  Link2,
  Network,
  Package,
  Percent,
  ScrollText,
  Shield,
  Sparkles,
  Split,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  Headphones,
} from "lucide-react";

export type BackOfficeModuleId =
  | "visao-geral"
  | "pacotes"
  | "rendimentos"
  | "afiliados"
  | "rede-binaria"
  | "qualificacao"
  | "bonus-binario"
  | "bonus-equipe"
  | "mensalidades"
  | "residual"
  | "operacoes"
  | "carteira"
  | "depositos"
  | "saques"
  | "extrato"
  | "relatorios-rede"
  | "central-qualificacao"
  | "admin"
  | "auditoria"
  | "casino-ao-vivo"
  | "casino-outros-jogos"
  | "casino-simulador"
  | "casino-estatisticas";

export type BackOfficeGroupId =
  | "produtos"
  | "rede"
  | "operacoes"
  | "financeiro"
  | "relatorios"
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
  label: string;
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
    description: "Pacotes, rendimentos e mensalidades.",
    moduleIds: ["pacotes", "rendimentos", "mensalidades"],
  },
  {
    id: "rede",
    label: "Rede",
    path: "/back-office/rede",
    icon: Network,
    description: "Afiliados, binário, qualificação e bônus.",
    moduleIds: [
      "afiliados",
      "rede-binaria",
      "qualificacao",
      "bonus-binario",
      "bonus-equipe",
    ],
  },
  {
    id: "operacoes",
    label: "Operações",
    path: "/back-office/operacoes",
    icon: BarChart3,
    description: "Comissões, automação e casino ao vivo.",
    moduleIds: [
      "operacoes",
      "casino-ao-vivo",
      "casino-outros-jogos",
      "casino-simulador",
      "casino-estatisticas",
    ],
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
    id: "relatorios",
    label: "Relatórios",
    path: "/back-office/relatorios",
    icon: ClipboardList,
    description: "Rede e central de qualificação.",
    moduleIds: ["relatorios-rede", "central-qualificacao"],
  },
  {
    id: "administracao",
    label: "Administração",
    path: "/back-office/administracao",
    icon: Shield,
    description: "Painel admin e auditoria.",
    moduleIds: ["admin", "auditoria"],
  },
];

export const OPERACOES_SECTIONS: BackOfficeGroupSection[] = [
  {
    label: "Operações",
    moduleIds: ["operacoes"],
  },
  {
    label: "Casino ao vivo",
    moduleIds: [
      "casino-ao-vivo",
      "casino-outros-jogos",
      "casino-simulador",
      "casino-estatisticas",
    ],
  },
];

export const ADMINISTRACAO_SECTIONS: BackOfficeGroupSection[] = [
  {
    label: "Gestão",
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
  rendimentos: {
    label: "Rendimentos diários",
    icon: TrendingUp,
    description: "Motor de ganhos automáticos dos pacotes.",
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
    description: "Lados esquerdo/direito e árvore genealógica.",
  },
  qualificacao: {
    label: "Qualificação",
    icon: Award,
    description: "Critérios e graduações Bronze a Imperial.",
  },
  "bonus-binario": {
    label: "Bônus binário",
    icon: Split,
    description: "Percentual sobre menor lado e tetos.",
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
  admin: {
    label: "Painel administrativo",
    icon: UserCog,
    description: "Usuários, financeiro, bônus e rede.",
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
  "casino-outros-jogos": {
    label: "Outros jogos",
    icon: Gamepad2,
    description: "24D Spin, Super Trunfo e Football Blitz ao vivo.",
  },
  "casino-simulador": {
    label: "Simulador",
    icon: Coins,
    description: "Simulador de roleta com giros ao vivo.",
  },
  "casino-estatisticas": {
    label: "Estatísticas",
    icon: BarChart3,
    description: "Resumo ao vivo e estatísticas por mesa.",
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
  if (groupId === "operacoes") return OPERACOES_SECTIONS;
  return null;
}

/** @deprecated Use backOfficeSidebarNav */
export function backOfficeNavGroups(): { group: string; items: BackOfficeNavItem[] }[] {
  return BACK_OFFICE_GROUPS.map((g) => ({
    group: g.label,
    items: getModulesForGroup(g.id),
  }));
}
