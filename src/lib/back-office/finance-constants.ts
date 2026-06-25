export const MIN_DEPOSIT_AMOUNT = 50;
export const MIN_WITHDRAWAL_AMOUNT = 50;

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
  afiliados: "Afiliados (30%)",
  automacao: "Automação (20%)",
  empresa: "Empresa (50%)",
  binario: "Binário (legado)",
  residual: "Residual (legado)",
  operacoes: "Operações (legado)",
};

/** Buckets que o utilizador pode sacar. */
export const WITHDRAWABLE_BUCKETS: WalletBucket[] = ["rendimentos", "afiliados", "automacao"];

export const DEPOSIT_CREDIT_BUCKET: WalletBucket = "rendimentos";
