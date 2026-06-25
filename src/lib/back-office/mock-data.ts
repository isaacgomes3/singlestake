import type { BackOfficeOverview } from "@/lib/back-office/types";

/** Dados de demonstração até integração com API/banco. */
export const MOCK_BACK_OFFICE_OVERVIEW: BackOfficeOverview = {
  earningsBalance: 0,
  availableBalance: 1_250.5,
  directReferrals: 2,
  activePlanValue: 0,
  referralLink: "https://singlestake.com/r/ABC123",
  recentEntries: [
    {
      date: "24/06/2026",
      description: "Bônus de Indicação Direta",
      type: "Crédito",
      amount: 50,
    },
    {
      date: "23/06/2026",
      description: "Rendimento diário — Pacote Prata",
      type: "Crédito",
      amount: 12.5,
    },
    {
      date: "22/06/2026",
      description: "Residual mensalidade — Nível 1",
      type: "Crédito",
      amount: 8,
    },
    {
      date: "20/06/2026",
      description: "Saque PIX",
      type: "Débito",
      amount: 200,
    },
  ],
  marketChart: [
    { label: "10:00", value: 104.2 },
    { label: "11:00", value: 104.5 },
    { label: "12:00", value: 104.1 },
    { label: "13:00", value: 104.8 },
    { label: "14:00", value: 105.1 },
    { label: "15:00", value: 104.9 },
    { label: "16:00", value: 105.4 },
    { label: "17:00", value: 105.2 },
  ],
  blockedBalance: 1_200,
  dailyEarnings: 186.4,
  accumulatedEarnings: 143,
  totalDeposited: 25_000,
  totalWithdrawn: 11_500,
  packageStatus: "active",
  subscriptionStatus: "active",
  affiliateCount: 127,
  networkVolume: 384_200,
  nextQualifications: [
    { rank: "ouro", missing: "2 qualificadores diretos · volume mínimo R$ 50.000" },
    { rank: "diamante", missing: "4 qualificadores · mensalidade ativa · pacote ouro" },
  ],
  automation: {
    investedBase: 0,
    earnedOnBase: 0,
    walletBalance: 0,
    displayBalance: 0,
    hasStartPack: false,
  },
};

export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
