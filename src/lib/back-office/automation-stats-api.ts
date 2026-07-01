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

export async function setAutomationTriggerEnabled(
  id: "three" | "crossing" | "fibonacci" | "fibonacciDozen" | "fibonacciColumn",
  enabled: boolean,
): Promise<{ ok: true; data: AutomationStatsDto } | { ok: false; error: string }> {
  const res = await fetch("/api/back-office/admin/automation-stats", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, enabled }),
  });
  const data = await parseJson<{ ok: boolean; data?: AutomationStatsDto; error?: string }>(res);
  if (!data?.ok || !data.data) {
    return { ok: false, error: data?.error ?? "Erro ao actualizar gatilho." };
  }
  return { ok: true, data: data.data };
}

export async function saveFibonacciAbsenceSpins(
  absenceSpins: number,
): Promise<{ ok: true; data: AutomationStatsDto } | { ok: false; error: string }> {
  const res = await fetch("/api/back-office/admin/automation-stats", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fibonacciAbsenceSpins: absenceSpins }),
  });
  const data = await parseJson<{ ok: boolean; data?: AutomationStatsDto; error?: string }>(res);
  if (!data?.ok || !data.data) {
    return { ok: false, error: data?.error ?? "Erro ao guardar giros de ausência." };
  }
  return { ok: true, data: data.data };
}
