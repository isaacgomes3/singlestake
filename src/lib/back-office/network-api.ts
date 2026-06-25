import type {
  AffiliatesData,
  BinaryNetworkData,
  NetworkBonusesData,
  QualificationProgress,
  SubAccountView,
} from "@/lib/back-office/network-types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAffiliates(): Promise<AffiliatesData | null> {
  const res = await fetch("/api/back-office/network/affiliates", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; data?: AffiliatesData }>(res);
  return data?.ok ? (data.data ?? null) : null;
}

export async function fetchBinaryNetwork(): Promise<BinaryNetworkData | null> {
  const res = await fetch("/api/back-office/network/binary", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; data?: BinaryNetworkData }>(res);
  return data?.ok ? (data.data ?? null) : null;
}

export async function fetchQualification(): Promise<QualificationProgress | null> {
  const res = await fetch("/api/back-office/network/qualification", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; data?: QualificationProgress }>(res);
  return data?.ok ? (data.data ?? null) : null;
}

export async function fetchNetworkBonuses(): Promise<NetworkBonusesData | null> {
  const res = await fetch("/api/back-office/network/bonuses", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; data?: NetworkBonusesData }>(res);
  return data?.ok ? (data.data ?? null) : null;
}

export async function fetchSubAccounts(): Promise<SubAccountView[]> {
  const res = await fetch("/api/back-office/network/sub-accounts", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; items?: SubAccountView[] }>(res);
  return data?.ok ? (data.items ?? []) : [];
}

export async function createSubAccount(input: {
  name: string;
  password: string;
  level: number;
  legSide: "left" | "right";
}): Promise<
  | { ok: true; subAccount: SubAccountView; credentials: { email: string; password: string } }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/back-office/network/sub-accounts", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
  const data = await parseJson<{
    ok: boolean;
    error?: string;
    subAccount?: SubAccountView;
    credentials?: { email: string; password: string };
  }>(res);
  if (!data?.ok) return { ok: false, error: data?.error ?? "Erro ao criar sub-conta." };
  if (!data.subAccount || !data.credentials) {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  return { ok: true, subAccount: data.subAccount, credentials: data.credentials };
}

export async function purchaseSubAccountStart(
  subAccountId: string,
): Promise<{ ok: true; subAccount: SubAccountView } | { ok: false; error: string }> {
  const res = await fetch(`/api/back-office/network/sub-accounts/${subAccountId}/start`, {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
  });
  const data = await parseJson<{
    ok: boolean;
    error?: string;
    subAccount?: SubAccountView;
  }>(res);
  if (!data?.ok) return { ok: false, error: data?.error ?? "Erro ao activar Start." };
  if (!data.subAccount) return { ok: false, error: "Resposta inválida do servidor." };
  return { ok: true, subAccount: data.subAccount };
}

export async function copyReferralLink(link: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}
