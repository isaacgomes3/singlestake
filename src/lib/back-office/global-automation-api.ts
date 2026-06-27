import type { AutomationSimApiSnapshot } from "@/lib/roulette/automationSimTypes";

export type GlobalAutomationLedgerEntry = {
  id: string;
  entryType: "credit" | "debit";
  amount: number;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

export type GlobalAutomationFinance = {
  balance: number;
  initialCapital: number;
  capitalRegisteredAt: number | null;
  entries: GlobalAutomationLedgerEntry[];
};

export type GlobalAutomationApiResponse = {
  ok: boolean;
  finance?: GlobalAutomationFinance;
  automation?: AutomationSimApiSnapshot | null;
  error?: string;
};

export async function fetchGlobalAutomationFinance(): Promise<{
  finance: GlobalAutomationFinance | null;
  automation: AutomationSimApiSnapshot | null;
}> {
  const res = await fetch("/api/back-office/global-automation", { credentials: "include" });
  const data = (await res.json().catch(() => null)) as GlobalAutomationApiResponse | null;
  if (!res.ok || !data?.ok || !data.finance) {
    return { finance: null, automation: null };
  }
  return { finance: data.finance, automation: data.automation ?? null };
}
