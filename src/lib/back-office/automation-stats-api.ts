import type { AutomationStatsDto } from "@/lib/back-office/automation-stats-types";

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAutomationStats(): Promise<AutomationStatsDto | null> {
  try {
    const res = await fetch("/api/back-office/admin/automation-stats", {
      credentials: "include",
      signal: AbortSignal.timeout(45_000),
    });
    const data = await parseJson<{ ok: boolean; data?: AutomationStatsDto; error?: string }>(res);
    return data?.ok ? (data.data ?? null) : null;
  } catch {
    return null;
  }
}

export async function setAutomationTriggerEnabled(
  id:
    | "three"
    | "crossing"
    | "fibonacci"
    | "repeticao"
    | "rotacao"
    | "fibonacciDozen"
    | "fibonacciColumn"
    | "repeticaoDozen"
    | "repeticaoColumn"
    | "crossingCorAltura"
    | "crossingAlturaParidade",
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

export async function saveFibonacciZoneAbsenceSpins(
  zone: "dozen" | "column",
  absenceSpins: number,
): Promise<{ ok: true; data: AutomationStatsDto } | { ok: false; error: string }> {
  const body =
    zone === "dozen"
      ? { fibonacciDozenAbsenceSpins: absenceSpins }
      : { fibonacciColumnAbsenceSpins: absenceSpins };
  const res = await fetch("/api/back-office/admin/automation-stats", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ ok: boolean; data?: AutomationStatsDto; error?: string }>(res);
  if (!data?.ok || !data.data) {
    return { ok: false, error: data?.error ?? "Erro ao guardar giros de ausência." };
  }
  return { ok: true, data: data.data };
}

export async function saveRepeticaoZoneAbsenceSpins(
  zone: "dozen" | "column",
  absenceSpins: number,
): Promise<{ ok: true; data: AutomationStatsDto } | { ok: false; error: string }> {
  const body =
    zone === "dozen"
      ? { repeticaoDozenAbsenceSpins: absenceSpins }
      : { repeticaoColumnAbsenceSpins: absenceSpins };
  const res = await fetch("/api/back-office/admin/automation-stats", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ ok: boolean; data?: AutomationStatsDto; error?: string }>(res);
  if (!data?.ok || !data.data) {
    return { ok: false, error: data?.error ?? "Erro ao guardar giros de ausência." };
  }
  return { ok: true, data: data.data };
}

export async function saveCrossingAxisAbsenceSpins(
  axis: "corAltura" | "alturaParidade",
  absenceSpins: number,
): Promise<{ ok: true; data: AutomationStatsDto } | { ok: false; error: string }> {
  const body =
    axis === "corAltura"
      ? { crossingCorAlturaAbsenceSpins: absenceSpins }
      : { crossingAlturaParidadeAbsenceSpins: absenceSpins };
  const res = await fetch("/api/back-office/admin/automation-stats", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ ok: boolean; data?: AutomationStatsDto; error?: string }>(res);
  if (!data?.ok || !data.data) {
    return { ok: false, error: data?.error ?? "Erro ao guardar giros de ausência." };
  }
  return { ok: true, data: data.data };
}

export async function saveCrossingAxisAbsenceAuto(
  axis: "corAltura" | "alturaParidade",
  absenceAuto: boolean,
): Promise<{ ok: true; data: AutomationStatsDto } | { ok: false; error: string }> {
  const body =
    axis === "corAltura"
      ? { crossingCorAlturaAbsenceAuto: absenceAuto }
      : { crossingAlturaParidadeAbsenceAuto: absenceAuto };
  const res = await fetch("/api/back-office/admin/automation-stats", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ ok: boolean; data?: AutomationStatsDto; error?: string }>(res);
  if (!data?.ok || !data.data) {
    return { ok: false, error: data?.error ?? "Erro ao actualizar modo automático." };
  }
  return { ok: true, data: data.data };
}

/** @deprecated Use saveFibonacciZoneAbsenceSpins */
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
