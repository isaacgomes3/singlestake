import type {
  BinaryBonusConfig,
  InvestmentPackage,
  ReferralLevel,
  ResidualLevel,
} from "@/lib/back-office/types";

export const REFERRAL_LEVELS: ReferralLevel[] = [
  { level: 1, percent: 10 },
  { level: 2, percent: 5 },
  { level: 3, percent: 3 },
  { level: 4, percent: 1 },
  { level: 5, percent: 1 },
];

export const RESIDUAL_LEVELS: ResidualLevel[] = [
  { level: 1, percent: 20 },
  { level: 2, percent: 10 },
  { level: 3, percent: 5 },
  { level: 4, percent: 3 },
  { level: 5, percent: 2 },
  { level: 6, percent: 2 },
  { level: 7, percent: 1 },
  { level: 8, percent: 1 },
  { level: 9, percent: 1 },
  { level: 10, percent: 1 },
];

export const DEFAULT_PACKAGES: InvestmentPackage[] = [
  {
    id: "bronze",
    name: "Pacote Bronze",
    minAmount: 500,
    maxAmount: 500,
    dailyYieldPct: 1.2,
    termDays: 180,
    active: true,
  },
  {
    id: "prata",
    name: "Pacote Prata",
    minAmount: 1000,
    maxAmount: 1000,
    dailyYieldPct: 1.5,
    termDays: 180,
    active: true,
  },
  {
    id: "ouro",
    name: "Pacote Ouro",
    minAmount: 5000,
    maxAmount: 5000,
    dailyYieldPct: 1.8,
    termDays: 365,
    active: true,
  },
];

export const DEFAULT_BINARY_CONFIG: BinaryBonusConfig = {
  percentOnWeakerLeg: 8,
  dailyCap: 500,
  weeklyCap: 2500,
  monthlyCap: 8000,
};

export const QUALIFICATION_RANKS = [
  { id: "bronze", label: "Bronze" },
  { id: "prata", label: "Prata" },
  { id: "ouro", label: "Ouro" },
  { id: "diamante", label: "Diamante" },
  { id: "imperial", label: "Imperial" },
] as const;
