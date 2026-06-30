export type PaymentGatewaySettingsDto = {
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  enabled: boolean;
  hasClientSecret?: boolean;
  withdrawalMode: "manual" | "automatic_up_to_limit";
  withdrawalAutoLimit: number;
  pixManualConfirmation: boolean;
};

export async function fetchPaymentGatewaySettings(): Promise<PaymentGatewaySettingsDto | null> {
  const res = await fetch("/api/back-office/admin/payment-gateway", { credentials: "include" });
  const data = (await res.json()) as { ok: boolean; settings?: PaymentGatewaySettingsDto };
  if (!data.ok || !data.settings) return null;
  return data.settings;
}

export async function savePaymentGatewaySettings(
  input: Partial<PaymentGatewaySettingsDto>,
): Promise<{ ok: true; settings: PaymentGatewaySettingsDto } | { ok: false; error: string }> {
  const res = await fetch("/api/back-office/admin/payment-gateway", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    ok: boolean;
    settings?: PaymentGatewaySettingsDto;
    error?: string;
  };
  if (!data.ok || !data.settings) {
    return { ok: false, error: data.error ?? "Erro ao guardar gateway." };
  }
  return { ok: true, settings: data.settings };
}
