import { getDb } from "@/lib/server/db/client";
import { systemSettings } from "@/lib/server/db/schema";

export const PAYMENT_GATEWAY_SETTINGS_KEY = "payment_gateway" as const;

export type PaymentGatewaySettings = {
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  enabled: boolean;
};

export const DEFAULT_PAYMENT_GATEWAY_SETTINGS: PaymentGatewaySettings = {
  apiBaseUrl: "https://api.lucpaguei.com",
  clientId: "stake37_MLRCIKYE",
  clientSecret:
    "ED8xO8R5OiQYOsA4ScbSEmOjqcAYxBCXK933JUj4xhQOJemkeLglqAtGSE6q9WbmCio4onZVi76UkrejfoHnJaleVNzWUSHM2e5j",
  callbackUrl: "",
  enabled: true,
};

function defaultCallbackUrl(): string {
  const base = (process.env.PUBLIC_APP_URL ?? "https://stake37.com.br").replace(/\/$/, "");
  return `${base}/api/webhooks/luc-paguei`;
}

function fromEnv(): Partial<PaymentGatewaySettings> {
  const clientId = process.env.LUC_PAGUEI_CLIENT_ID?.trim();
  const clientSecret = process.env.LUC_PAGUEI_CLIENT_SECRET?.trim();
  const apiBaseUrl = process.env.LUC_PAGUEI_API_BASE_URL?.trim();
  const callbackUrl = process.env.LUC_PAGUEI_CALLBACK_URL?.trim();

  const out: Partial<PaymentGatewaySettings> = {};
  if (apiBaseUrl) out.apiBaseUrl = apiBaseUrl.replace(/\/$/, "");
  if (clientId) out.clientId = clientId;
  if (clientSecret) out.clientSecret = clientSecret;
  if (callbackUrl) out.callbackUrl = callbackUrl;
  return out;
}

function mergePaymentGatewaySettings(
  base: PaymentGatewaySettings,
  env: Partial<PaymentGatewaySettings>,
): PaymentGatewaySettings {
  const defaults: PaymentGatewaySettings = {
    ...DEFAULT_PAYMENT_GATEWAY_SETTINGS,
    callbackUrl: defaultCallbackUrl(),
  };

  return {
    apiBaseUrl: env.apiBaseUrl ?? base.apiBaseUrl || defaults.apiBaseUrl,
    clientId: env.clientId ?? base.clientId || defaults.clientId,
    clientSecret: env.clientSecret ?? base.clientSecret || defaults.clientSecret,
    callbackUrl: env.callbackUrl ?? base.callbackUrl || defaults.callbackUrl,
    enabled: true,
  };
}

function parseStored(json: string): PaymentGatewaySettings {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    return {
      apiBaseUrl:
        typeof raw.api_base_url === "string" && raw.api_base_url.trim()
          ? raw.api_base_url.trim().replace(/\/$/, "")
          : DEFAULT_PAYMENT_GATEWAY_SETTINGS.apiBaseUrl,
      clientId: typeof raw.client_id === "string" ? raw.client_id.trim() : "",
      clientSecret: typeof raw.client_secret === "string" ? raw.client_secret.trim() : "",
      callbackUrl:
        typeof raw.callback_url === "string" && raw.callback_url.trim()
          ? raw.callback_url.trim()
          : defaultCallbackUrl(),
      enabled: raw.enabled === true || raw.enabled === 1 || raw.enabled === "1",
    };
  } catch {
    return { ...DEFAULT_PAYMENT_GATEWAY_SETTINGS, callbackUrl: defaultCallbackUrl() };
  }
}

function toStored(settings: PaymentGatewaySettings): string {
  return JSON.stringify({
    api_base_url: settings.apiBaseUrl,
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    callback_url: settings.callbackUrl,
    enabled: settings.enabled,
  });
}

export async function getPaymentGatewaySettings(): Promise<PaymentGatewaySettings> {
  const db = getDb();
  const row = await db.query.systemSettings.findFirst({
    where: (t, { eq }) => eq(t.key, PAYMENT_GATEWAY_SETTINGS_KEY),
  });

  const base = row ? parseStored(row.valueJson) : {
    ...DEFAULT_PAYMENT_GATEWAY_SETTINGS,
    callbackUrl: defaultCallbackUrl(),
  };

  const env = fromEnv();
  return mergePaymentGatewaySettings(base, env);
}

export async function savePaymentGatewaySettings(
  input: PaymentGatewaySettings,
): Promise<PaymentGatewaySettings> {
  const current = await getPaymentGatewaySettings();
  const next: PaymentGatewaySettings = {
    apiBaseUrl:
      input.apiBaseUrl.trim().replace(/\/$/, "") ||
      current.apiBaseUrl ||
      DEFAULT_PAYMENT_GATEWAY_SETTINGS.apiBaseUrl,
    clientId: input.clientId.trim() || current.clientId,
    clientSecret: input.clientSecret.trim() || current.clientSecret,
    callbackUrl: input.callbackUrl.trim() || current.callbackUrl || defaultCallbackUrl(),
    enabled: true,
  };

  const db = getDb();
  await db
    .insert(systemSettings)
    .values({
      key: PAYMENT_GATEWAY_SETTINGS_KEY,
      valueJson: toStored(next),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { valueJson: toStored(next), updatedAt: new Date() },
    });

  return getPaymentGatewaySettings();
}

/** Credenciais completas — gateway sempre activo quando configurado. */
export async function isLucPagueiGatewayReady(): Promise<boolean> {
  const s = await getPaymentGatewaySettings();
  return Boolean(s.clientId && s.clientSecret && s.apiBaseUrl);
}

/** Versão segura para o admin (sem secret). */
export function redactPaymentGatewaySettings(
  settings: PaymentGatewaySettings,
): PaymentGatewaySettings & { hasClientSecret: boolean } {
  return {
    ...settings,
    enabled: true,
    clientSecret: settings.clientSecret ? "••••••••" : "",
    hasClientSecret: Boolean(settings.clientSecret),
  };
}
