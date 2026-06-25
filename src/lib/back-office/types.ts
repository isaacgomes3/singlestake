/** Tipos do sistema de afiliados / MMN — back office. */

export type PackageStatus = "active" | "inactive";
export type SubscriptionStatus = "grace" | "active" | "pending" | "expired";
export type WalletBucket =
  | "rendimentos"
  | "afiliados"
  | "binario"
  | "residual"
  | "operacoes";

export type QualificationRank = "bronze" | "prata" | "ouro" | "diamante" | "imperial";

/** Automação pessoal do utilizador (base em pacotes + rendimentos sobre a base). */
export type UserAutomationSummary = {
  /** Soma da base de automação nos pacotes activos (múltiplos de R$ 250, dentro do Start). */
  investedBase: number;
  /** Rendimentos já creditados sobre a base de automação. */
  earnedOnBase: number;
  /** Saldo na carteira de automação (base + ganhos creditados). */
  walletBalance: number;
  /** Saldo total apresentado no cartão (carteira ou base + ganhos). */
  displayBalance: number;
  hasStartPack: boolean;
};

export type BackOfficeOverview = {
  /** Soma dos saldos disponíveis nas carteiras sacáveis (caixa, afiliados, automação). */
  availableBalance: number;
  blockedBalance: number;
  dailyEarnings: number;
  /** Créditos acumulados na carteira de afiliados (indicação, binário, residual). */
  accumulatedEarnings: number;
  totalDeposited: number;
  totalWithdrawn: number;
  packageStatus: PackageStatus | "none";
  subscriptionStatus: SubscriptionStatus;
  affiliateCount: number;
  networkVolume: number;
  nextQualifications: { rank: QualificationRank; missing: string }[];
  /** Painel visão geral — saldo rendimento / cashback */
  earningsBalance: number;
  /** Indicados directos */
  directReferrals: number;
  /** Valor do plano / pacote activo */
  activePlanValue: number;
  referralLink: string;
  recentEntries: BackOfficeLedgerEntry[];
  marketChart: { label: string; value: number }[];
  automation: UserAutomationSummary;
};

export type BackOfficeLedgerEntry = {
  date: string;
  description: string;
  type: "Crédito" | "Débito";
  amount: number;
};

export type InvestmentPackage = {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  dailyYieldPct: number;
  termDays: number;
  active: boolean;
};

export type ReferralLevel = { level: number; percent: number };
export type ResidualLevel = { level: number; percent: number };

export type BinaryBonusConfig = {
  percentOnWeakerLeg: number;
  dailyCap: number;
  weeklyCap: number;
  monthlyCap: number;
};

export type AuditLogEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
};
