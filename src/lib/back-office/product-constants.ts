/** Regras de produto: splits administrativos (carteiras da empresa) e mensalidade. */

/** Divisão interna da empresa ao registar pagamento de automação (carteiras admin). */
export const COMPANY_AUTOMATION_PAYMENT_SPLIT = {
  afiliados: 0.3,
  automacao: 0.2,
  empresa: 0.5,
} as const;

/** Start R$ 50 e mensalidade: metade empresa, metade pool de rede (carteira afiliados admin). */
export const START_SUBSCRIPTION_COMPANY_EMPRESA = 25;
export const START_SUBSCRIPTION_COMPANY_AFILIADOS_POOL = 25;

export const SUBSCRIPTION_NETWORK_SHARE = 0.5;
export const SUBSCRIPTION_COMPANY_SHARE = 0.5;

export const AUTOMATION_MAX_DAILY_YIELD_PCT = 1;
export const AUTOMATION_YIELD_SETTING_KEY = "automation_daily_yield_pct";
export const MAX_PROFIT_MULTIPLIER = 2;
/** Indicação directa na compra de automação — 10% do valor da cota (só nível 1). */
export const AUTOMATION_DIRECT_REFERRAL_PCT = 10;
/** Duração máxima de cada cota de automação (12 meses). */
export const PACKAGE_TERM_MONTHS = 12;
export const ADHESION_DAYS = PACKAGE_TERM_MONTHS * 30;
export const SUBSCRIPTION_GRACE_DAYS = 30;
export const DEFAULT_SUBSCRIPTION_AMOUNT = 49.9;

export const START_PACKAGE_AMOUNT = 50;
export const START_PACKAGE_ID = "start";

/** Depósitos de automação — múltiplos de R$ 250. */
export const AUTOMATION_DEPOSIT_STEP = 250;
export const AUTOMATION_DEPOSIT_MIN = 250;
export const AUTOMATION_DEPOSIT_MAX = 50_000;

/** @deprecated */
export const AUTOMATION_PIX_PACKAGE_ID = "auto-250";

export const CATALOG_EXCLUDED_PACKAGE_IDS = new Set<string>([START_PACKAGE_ID]);

/** @deprecated Use COMPANY_AUTOMATION_PAYMENT_SPLIT */
export const PACKAGE_SPLIT_AUTOMATION = COMPANY_AUTOMATION_PAYMENT_SPLIT;

/** @deprecated Start usa valores fixos R$ 25 + R$ 25 */
export const PACKAGE_SPLIT_START = {
  afiliados: 0.5,
  automacao: 0,
  empresa: 0.5,
} as const;

export function validateAutomationDepositAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Informe um valor válido para automação.";
  }
  if (amount < AUTOMATION_DEPOSIT_MIN) {
    return `Depósito mínimo de automação: R$ ${AUTOMATION_DEPOSIT_MIN.toFixed(2)}.`;
  }
  if (amount > AUTOMATION_DEPOSIT_MAX) {
    return `Depósito máximo de automação: R$ ${AUTOMATION_DEPOSIT_MAX.toFixed(2)}.`;
  }
  if (amount % AUTOMATION_DEPOSIT_STEP !== 0) {
    return `O valor deve ser múltiplo de R$ ${AUTOMATION_DEPOSIT_STEP},00.`;
  }
  return null;
}

export function isAutomationDepositMultiple(amount: number): boolean {
  return validateAutomationDepositAmount(amount) === null;
}

export type PackageKind = "start" | "automation";

export type ProductPackage = {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  packageKind: PackageKind;
  active: boolean;
};

export const PRODUCT_PACKAGES: ProductPackage[] = [
  {
    id: "start",
    name: "Pacote Start",
    minAmount: START_PACKAGE_AMOUNT,
    maxAmount: START_PACKAGE_AMOUNT,
    packageKind: "start",
    active: true,
  },
  {
    id: "auto-250",
    name: "Automação R$ 250",
    minAmount: 250,
    maxAmount: 250,
    packageKind: "automation",
    active: true,
  },
  {
    id: "auto-500",
    name: "Automação R$ 500",
    minAmount: 500,
    maxAmount: 500,
    packageKind: "automation",
    active: true,
  },
  {
    id: "auto-1000",
    name: "Automação R$ 1.000",
    minAmount: 1000,
    maxAmount: 1000,
    packageKind: "automation",
    active: true,
  },
  {
    id: "auto-2500",
    name: "Automação R$ 2.500",
    minAmount: 2500,
    maxAmount: 2500,
    packageKind: "automation",
    active: true,
  },
  {
    id: "auto-5000",
    name: "Automação R$ 5.000",
    minAmount: 5000,
    maxAmount: 5000,
    packageKind: "automation",
    active: true,
  },
  {
    id: "automacao",
    name: "Depósito automação (valor livre)",
    minAmount: AUTOMATION_DEPOSIT_MIN,
    maxAmount: AUTOMATION_DEPOSIT_MAX,
    packageKind: "automation",
    active: true,
  },
];

export function calculateCompanyAutomationPaymentSplit(amount: number) {
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    empresaAmount: round(amount * COMPANY_AUTOMATION_PAYMENT_SPLIT.empresa),
    afiliadosPoolAmount: round(amount * COMPANY_AUTOMATION_PAYMENT_SPLIT.afiliados),
    automacaoAmount: round(amount * COMPANY_AUTOMATION_PAYMENT_SPLIT.automacao),
  };
}

export function calculateStartSubscriptionCompanySplit(amount: number) {
  const round = (v: number) => Math.round(v * 100) / 100;
  const half = round(amount / 2);
  return {
    empresaAmount: half,
    afiliadosPoolAmount: round(amount - half),
  };
}

/** @deprecated */
export function getPackageSplit(kind: PackageKind) {
  return kind === "start" ? PACKAGE_SPLIT_START : PACKAGE_SPLIT_AUTOMATION;
}
