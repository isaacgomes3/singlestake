/** Regras de produto: splits de pacotes, automação e mensalidade. */

export const PACKAGE_SPLIT_AUTOMATION = {
  afiliados: 0.3,
  automacao: 0.2,
  empresa: 0.5,
} as const;

export const PACKAGE_SPLIT_START = {
  afiliados: 0.5,
  automacao: 0,
  empresa: 0.5,
} as const;

export const SUBSCRIPTION_NETWORK_SHARE = 0.5;
export const SUBSCRIPTION_COMPANY_SHARE = 0.5;

export const AUTOMATION_MAX_DAILY_YIELD_PCT = 1;
export const MAX_PROFIT_MULTIPLIER = 2;
export const ADHESION_DAYS = 365;
export const SUBSCRIPTION_GRACE_DAYS = 30;
export const DEFAULT_SUBSCRIPTION_AMOUNT = 49.9;

/** Depósitos de automação dentro do Pack Start — múltiplos deste valor. */
export const AUTOMATION_DEPOSIT_STEP = 250;
export const AUTOMATION_DEPOSIT_MIN = 250;
export const AUTOMATION_DEPOSIT_MAX = 50_000;

export const START_PACKAGE_AMOUNT = 50;
export const START_PACKAGE_ID = "start";

/** Automação fixa R$ 250 — única com checkout PIX no catálogo. */
export const AUTOMATION_PIX_PACKAGE_ID = "auto-250";

/** Pacotes ocultos do catálogo (Start é pago no cadastro). */
export const CATALOG_EXCLUDED_PACKAGE_IDS = new Set<string>([START_PACKAGE_ID]);

/** Valida valor de depósito em automação. Devolve mensagem de erro ou null se válido. */
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

export function getPackageSplit(kind: PackageKind) {
  return kind === "start" ? PACKAGE_SPLIT_START : PACKAGE_SPLIT_AUTOMATION;
}
