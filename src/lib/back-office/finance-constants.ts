export const MIN_DEPOSIT_AMOUNT = 50;
export const MIN_WITHDRAWAL_AMOUNT = 50;
/** Máximo de pedidos de saque (não rejeitados) por utilizador por dia civil (SP). */
export const MAX_WITHDRAWALS_PER_USER_PER_DAY = 1;

export const DEPOSIT_METHODS = ["pix", "crypto"] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

export const WALLET_BUCKETS = [
  "rendimentos",
  "afiliados",
  "automacao",
  "empresa",
  /** @deprecated legado */
  "binario",
  /** @deprecated legado */
  "residual",
  /** @deprecated legado */
  "operacoes",
] as const;

export type WalletBucket = (typeof WALLET_BUCKETS)[number];

/** Carteiras principais exibidas no financeiro. */
export const FINANCE_DISPLAY_BUCKETS = ["rendimentos", "afiliados", "automacao"] as const;

export const WALLET_BUCKET_LABELS: Record<WalletBucket, string> = {
  rendimentos: "Saldo (caixa)",
  afiliados: "Afiliados",
  automacao: "Automação",
  empresa: "Empresa (50%)",
  binario: "Binário (legado)",
  residual: "Residual (legado)",
  operacoes: "Operações (legado)",
};

/** Buckets que o utilizador pode sacar. */
export const WITHDRAWABLE_BUCKETS: WalletBucket[] = ["rendimentos", "afiliados", "automacao"];

/** Pools internos da empresa — não expor no extrato do utilizador. */
export const COMPANY_INTERNAL_BUCKETS: WalletBucket[] = ["empresa", "afiliados", "automacao"];

/** Opções de filtro do extrato para utilizadores (sem pools internos). */
export const USER_LEDGER_FILTER_BUCKETS = [
  "rendimentos",
  "binario",
  "residual",
  "operacoes",
] as const satisfies readonly WalletBucket[];

export const DEPOSIT_CREDIT_BUCKET: WalletBucket = "rendimentos";
