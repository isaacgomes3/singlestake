import type {
  DepositRecord,
  LedgerEntryRecord,
  WalletRecord,
  WalletSummary,
  WithdrawalRecord,
} from "@/lib/back-office/finance-types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchDeposits(): Promise<DepositRecord[]> {
  const res = await fetch("/api/back-office/deposits", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; deposits?: DepositRecord[] }>(res);
  return data?.deposits ?? [];
}

export async function createDeposit(input: {
  amount: number;
  method: string;
  externalRef?: string;
  cpfDocument?: string;
}): Promise<
  | { ok: true; deposit?: DepositRecord; pix?: boolean }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/back-office/deposits", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ ok: boolean; error?: string; deposit?: DepositRecord; pix?: boolean }>(
    res,
  );
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível solicitar o depósito." };
  }
  return { ok: true, deposit: data.deposit, pix: data.pix };
}

export async function fetchDeposit(depositId: string): Promise<DepositRecord | null> {
  const res = await fetch(`/api/back-office/deposits/${depositId}`, { credentials: "include" });
  const data = await parseJson<{ ok: boolean; deposit?: DepositRecord }>(res);
  return data?.deposit ?? null;
}

export async function processDeposit(
  depositId: string,
  action: "approve" | "reject",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/deposits/${depositId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ action }),
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível processar o depósito." };
  }
  return { ok: true };
}

export async function fetchWithdrawals(): Promise<WithdrawalRecord[]> {
  const res = await fetch("/api/back-office/withdrawals", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; withdrawals?: WithdrawalRecord[] }>(res);
  return data?.withdrawals ?? [];
}

export async function createWithdrawal(input: {
  amount: number;
  bucket: string;
  pixKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/back-office/withdrawals", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível solicitar o saque." };
  }
  return { ok: true };
}

export async function processWithdrawal(
  withdrawalId: string,
  action: "approve" | "reject" | "paid",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/withdrawals/${withdrawalId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ action }),
  });
  const data = await parseJson<{ ok: boolean; error?: string }>(res);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Não foi possível processar o saque." };
  }
  return { ok: true };
}

export async function fetchWallets(): Promise<WalletSummary> {
  const res = await fetch("/api/back-office/wallet", { credentials: "include" });
  const data = await parseJson<{
    ok: boolean;
    wallets?: WalletRecord[];
    automationDepositedTotal?: number;
    automationBalance?: number;
  }>(res);
  return {
    wallets: data?.wallets ?? [],
    automationDepositedTotal: data?.automationDepositedTotal ?? 0,
    automationBalance: data?.automationBalance ?? 0,
  };
}

export type LedgerQuery = {
  bucket?: string;
  entryType?: "credit" | "debit";
  limit?: number;
};

export async function fetchLedger(query: LedgerQuery = {}): Promise<LedgerEntryRecord[]> {
  const params = new URLSearchParams();
  if (query.bucket) params.set("bucket", query.bucket);
  if (query.entryType) params.set("entryType", query.entryType);
  if (query.limit) params.set("limit", String(query.limit));

  const qs = params.toString();
  const res = await fetch(`/api/back-office/ledger${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  const data = await parseJson<{ ok: boolean; entries?: LedgerEntryRecord[] }>(res);
  return data?.entries ?? [];
}
