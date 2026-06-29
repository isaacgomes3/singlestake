import { randomBytes } from "node:crypto";

import type { PaymentGatewaySettings } from "@/lib/server/finance/payment-gateway-settings";
import { normalizeCpf } from "@/lib/server/finance/cpf";
import {
  decodePixEmvFromBase64,
  isPixEmvPayload,
  normalizePixEmvPayload,
} from "@/lib/server/finance/pix-qr";

export type LucPixChargeResult = {
  pixCode: string;
  transactionId: string | null;
  qrCodeBase64: string | null;
};

export type LucWithdrawResult = {
  transactionId: string | null;
  raw: unknown;
};

export function buildPaymentExternalId(
  prefix: "DEP" | "PKG" | "SAQ",
  userId: string,
): string {
  const uid = userId.replace(/-/g, "").slice(0, 8);
  const ts = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const rnd = randomBytes(3).toString("hex");
  return `${prefix}-${uid}-${ts}-${rnd}`;
}

export function detectPixKeyType(pixKey: string): "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM" {
  const trimmed = pixKey.trim();
  if (trimmed.includes("@")) return "EMAIL";

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  if (/^\+?\d{10,13}$/.test(digits)) return "PHONE";
  if (/^[0-9a-f-]{32,36}$/i.test(trimmed)) return "RANDOM";
  return "RANDOM";
}

async function gatewayRequest(
  settings: PaymentGatewaySettings,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: unknown }> {
  const url = `${settings.apiBaseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    /* texto bruto */
  }

  return { status: res.status, body: parsed };
}

export async function lucPagueiLogin(
  settings: PaymentGatewaySettings,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const res = await gatewayRequest(settings, "POST", "/api/auth/login", {
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
  });

  const body = res.body as { token?: string; message?: string; error?: string };
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (res.status < 200 || res.status >= 300 || !token) {
    const detail = body?.message ?? body?.error ?? JSON.stringify(body);
    return { ok: false, error: `Falha ao autenticar no gateway (${res.status}): ${detail}` };
  }
  return { ok: true, token };
}

function pickPixEmvFromCandidates(candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c !== "string" || !c.trim()) continue;
    const trimmed = c.trim();
    if (isPixEmvPayload(trimmed)) return normalizePixEmvPayload(trimmed);
    const fromB64 = decodePixEmvFromBase64(trimmed);
    if (fromB64) return fromB64;
  }
  return null;
}

function extractPixCode(body: Record<string, unknown>): string | null {
  const qrNode = (body.qrCodeResponse ?? body.qr_code_response) as Record<string, unknown> | undefined;
  const payloadNode = (body.payload ?? body.pix) as Record<string, unknown> | undefined;
  const qrCodeObj = (body.qrCode ?? qrNode?.qrCode) as Record<string, unknown> | undefined;

  return pickPixEmvFromCandidates([
    qrNode?.pixCode,
    qrNode?.pix_code,
    qrNode?.copiaecola,
    qrNode?.copia_e_cola,
    qrNode?.pixCopiaCola,
    qrNode?.pixCopiaECola,
    qrNode?.brCode,
    qrNode?.brcode,
    qrNode?.emv,
    payloadNode?.data,
    payloadNode?.emv,
    payloadNode?.pixCode,
    payloadNode?.pixCopiaCola,
    payloadNode?.brCode,
    qrCodeObj?.emv,
    body.pixCode,
    body.pix_code,
    body.copiaecola,
    body.copia_e_cola,
    body.pixCopiaCola,
    body.brCode,
    body.brcode,
    body.copyPaste,
    body.copy_paste,
    body.emv,
    /* qrcode por último — gateways costumam enviar imagem neste campo */
    qrNode?.qrcode,
    body.qrcode,
  ]);
}

function extractTransactionId(body: Record<string, unknown>, fallback: string): string {
  const qrNode = (body.qrCodeResponse ?? body.qr_code_response) as Record<string, unknown> | undefined;
  const candidates = [
    qrNode?.transactionId,
    qrNode?.transaction_id,
    body.transactionId,
    body.transaction_id,
    body.txid,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return fallback;
}

export async function lucPagueiCreatePixDeposit(input: {
  settings: PaymentGatewaySettings;
  amount: number;
  externalId: string;
  payer: { name: string; email: string; document: string };
}): Promise<{ ok: true; charge: LucPixChargeResult } | { ok: false; error: string }> {
  const login = await lucPagueiLogin(input.settings);
  if (!login.ok) return login;

  const document = normalizeCpf(input.payer.document);
  const res = await gatewayRequest(
    input.settings,
    "POST",
    "/api/payments/deposit",
    {
      amount: Number(input.amount.toFixed(2)),
      external_id: input.externalId,
      clientCallbackUrl: input.settings.callbackUrl,
      payer: {
        name: input.payer.name,
        email: input.payer.email,
        document,
      },
    },
    login.token,
  );

  const body = (typeof res.body === "object" && res.body !== null ? res.body : {}) as Record<
    string,
    unknown
  >;

  if (res.status < 200 || res.status >= 300) {
    const detail =
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error) ||
      JSON.stringify(body);
    return { ok: false, error: `Gateway recusou depósito (${res.status}): ${detail}` };
  }

  const pixCode = extractPixCode(body);
  if (!pixCode) {
    return {
      ok: false,
      error:
        "Gateway não devolveu código PIX válido (copia e cola EMV com CRC). Verifique a resposta do Luc Paguei.",
    };
  }

  return {
    ok: true,
    charge: {
      pixCode,
      transactionId: extractTransactionId(body, input.externalId),
      qrCodeBase64: null,
    },
  };
}

export async function lucPagueiWithdrawPix(input: {
  settings: PaymentGatewaySettings;
  amount: number;
  externalId: string;
  pixKey: string;
  name: string;
  taxId: string;
  description?: string;
}): Promise<{ ok: true; result: LucWithdrawResult } | { ok: false; error: string }> {
  const login = await lucPagueiLogin(input.settings);
  if (!login.ok) return login;

  const keyType = detectPixKeyType(input.pixKey);
  const res = await gatewayRequest(
    input.settings,
    "POST",
    "/api/withdrawals/withdraw",
    {
      amount: Number(input.amount.toFixed(2)),
      external_id: input.externalId,
      pix_key: input.pixKey.trim(),
      key_type: keyType,
      name: input.name,
      taxId: normalizeCpf(input.taxId),
      description: input.description ?? `Withdrawal ${input.externalId}`,
      clientCallbackUrl: input.settings.callbackUrl,
    },
    login.token,
  );

  const body = (typeof res.body === "object" && res.body !== null ? res.body : {}) as Record<
    string,
    unknown
  >;

  if (res.status < 200 || res.status >= 300) {
    const detail =
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error) ||
      JSON.stringify(body);
    return { ok: false, error: `Gateway recusou saque (${res.status}): ${detail}` };
  }

  const txId =
    (typeof body.transactionId === "string" && body.transactionId) ||
    (typeof body.transaction_id === "string" && body.transaction_id) ||
    null;

  return { ok: true, result: { transactionId: txId, raw: body } };
}

export function isLucPaymentStatusCompleted(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const s = status.trim().toUpperCase();
  return (
    s === "COMPLETED" ||
    s === "PAID" ||
    s === "CONFIRMED" ||
    s === "CONCLUIDO" ||
    s === "CONCLUÍDO" ||
    s === "APPROVED" ||
    s === "SUCCESS"
  );
}

export function isLucPaymentStatusFailed(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const s = status.trim().toUpperCase();
  return (
    s === "FAILED" ||
    s === "CANCELLED" ||
    s === "CANCELED" ||
    s === "REJECTED" ||
    s === "EXPIRED" ||
    s === "ERROR"
  );
}

/** Extrai identificadores do payload do webhook (vários formatos). */
export function parseLucWebhookPayload(body: unknown): {
  transactionId: string | null;
  externalId: string | null;
  status: string | null;
  amount: number | null;
  raw: Record<string, unknown>;
} {
  const raw = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const data = (raw.data ?? raw.payload ?? raw) as Record<string, unknown>;

  const pickString = (...keys: string[]): string | null => {
    for (const key of keys) {
      const v = data[key] ?? raw[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  const status = pickString("status", "payment_status", "state");
  const transactionId = pickString(
    "transaction_id",
    "transactionId",
    "txid",
    "gateway_transaction_id",
  );
  const externalId = pickString("external_id", "externalId", "reference", "merchant_reference");

  let amount: number | null = null;
  const amountRaw = data.amount ?? raw.amount ?? data.value ?? raw.value;
  if (typeof amountRaw === "number" && Number.isFinite(amountRaw)) amount = amountRaw;
  else if (typeof amountRaw === "string") {
    const n = Number(amountRaw.replace(",", "."));
    if (Number.isFinite(n)) amount = n;
  }

  return { transactionId, externalId, status, amount, raw };
}
