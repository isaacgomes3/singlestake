export type GlobalAutomationLedgerEntry = {
  id: string;
  entryType: "credit" | "debit";
  amount: number;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

export type GlobalAutomationLedgerTotals = {
  capitalCredit: number;
  settlementCredits: number;
  settlementDebits: number;
  operationsNet: number;
  expectedBalance: number;
  entryCount: number;
};

export type GlobalAutomationFinance = {
  balance: number;
  initialCapital: number;
  capitalRegisteredAt: number | null;
  totals: GlobalAutomationLedgerTotals;
  entries: GlobalAutomationLedgerEntry[];
};

export type GlobalAutomationApiResponse = {
  ok: boolean;
  finance?: GlobalAutomationFinance;
  error?: string;
};

export async function fetchGlobalAutomationFinance(): Promise<{
  finance: GlobalAutomationFinance | null;
}> {
  const res = await fetch("/api/back-office/global-automation", { credentials: "include" });
  const data = (await res.json().catch(() => null)) as GlobalAutomationApiResponse | null;
  if (!res.ok || !data?.ok || !data.finance) {
    return { finance: null };
  }
  return { finance: data.finance };
}
