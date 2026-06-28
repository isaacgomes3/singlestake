import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAutomationStats(): Promise<AutomationStatsDto | null> {
  const res = await fetch("/api/back-office/admin/automation-stats", { credentials: "include" });
  const data = await parseJson<{ ok: boolean; data?: AutomationStatsDto; error?: string }>(res);
  return data?.ok ? (data.data ?? null) : null;
}
