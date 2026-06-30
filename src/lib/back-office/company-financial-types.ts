export type CompanyWalletBucket = "empresa" | "afiliados" | "automacao";

export type CompanyFinancialMovement = {
  id: string;
  bucket: CompanyWalletBucket;
  entryType: "credit" | "debit";
  amount: number;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  actorLabel: string | null;
};

export type CompanyManualWithdrawal = {
  id: string;
  bucket: "empresa" | "automacao";
  amount: number;
  description: string;
  actorLabel: string;
  createdAt: string;
};

export type CompanyFinancialPanel = {
  balances: Record<CompanyWalletBucket, number>;
  splits: {
    automation: { afiliados: number; automacao: number; empresa: number };
    startSubscription: { empresa: number; afiliados: number };
  };
  movements: CompanyFinancialMovement[];
  manualWithdrawals: CompanyManualWithdrawal[];
};
