import type { GlobalAutomationConfig, GlobalAutomationConfigDto } from "@/lib/back-office/automation-config";

export type AutomationConfigApiResponse = {
  ok: boolean;
  error?: string;
  config?: GlobalAutomationConfigDto;
};

export async function fetchAutomationConfig(): Promise<AutomationConfigApiResponse["config"] | null> {
  try {
    const res = await fetch("/api/back-office/admin/automation-config", { credentials: "include" });
    const body = (await res.json()) as AutomationConfigApiResponse;
    if (!res.ok || !body.ok || !body.config) return null;
    return body.config;
  } catch {
    return null;
  }
}

export async function saveAutomationConfig(
  patch: Partial<
    Pick<GlobalAutomationConfig, "paused" | "baseStake" | "stopWin" | "stopLoss">
  >,
): Promise<AutomationConfigApiResponse> {
  try {
    const res = await fetch("/api/back-office/admin/automation-config", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return (await res.json()) as AutomationConfigApiResponse;
  } catch {
    return { ok: false, error: "Falha de rede." };
  }
}
