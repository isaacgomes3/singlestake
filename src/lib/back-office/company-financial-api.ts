import type { CompanyFinancialPanel } from "@/lib/back-office/company-financial-types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchCompanyFinancialPanel(): Promise<CompanyFinancialPanel | null> {
  const res = await fetch("/api/back-office/admin/company-financial-panel", {
    credentials: "include",
  });
  const data = await parseJson<{ ok: boolean; panel?: CompanyFinancialPanel }>(res);
  if (!res.ok || !data?.ok || !data.panel) return null;
  return data.panel;
}

export async function createCompanyManualWithdrawal(input: {
  bucket: "empresa" | "automacao";
  amount: number;
  description: string;
}): Promise<
  { ok: true; panel: CompanyFinancialPanel } | { ok: false; error: string }
> {
  const res = await fetch("/api/back-office/admin/company-financial-panel", {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(input),
  });
  const data = await parseJson<{
    ok: boolean;
    panel?: CompanyFinancialPanel;
    error?: string;
  }>(res);
  if (!res.ok || !data?.ok || !data.panel) {
    return { ok: false, error: data?.error ?? "Não foi possível registar a retirada." };
  }
  return { ok: true, panel: data.panel };
}
