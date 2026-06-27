import { readFileSync } from "node:fs";
import https from "node:https";

import { efiPixApiBase, type EfiPixConfig } from "@/lib/server/finance/efi-config";

let cachedAgent: https.Agent | undefined;
let cachedAgentCertPath: string | undefined;
let cachedToken: { value: string; expiresAt: number } | undefined;

function getMtlsAgent(config: EfiPixConfig): https.Agent {
  if (cachedAgent && cachedAgentCertPath === config.certPath) return cachedAgent;
  const pfx = readFileSync(config.certPath);
  cachedAgent = new https.Agent({
    pfx,
    passphrase: config.certPassphrase || undefined,
    rejectUnauthorized: true,
  });
  cachedAgentCertPath = config.certPath;
  return cachedAgent;
}

function efiRequest(
  config: EfiPixConfig,
  path: string,
  init: { method: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; body: string }> {
  const base = efiPixApiBase(config.sandbox);
  const url = new URL(`${base}${path}`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: init.method,
        headers: init.headers,
        agent: getMtlsAgent(config),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 500,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

export async function getEfiAccessToken(config: EfiPixConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const res = await efiRequest(config, "/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });

  const data = JSON.parse(res.body) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (res.status < 200 || res.status >= 300 || !data.access_token) {
    const detail = data.error_description ?? data.error ?? res.body;
    throw new Error(`Efi OAuth falhou (${res.status}): ${detail}`);
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

export type EfiCobResult = {
  txid: string;
  locId: number;
  status: string;
  pixCopyPaste: string;
  qrCodeBase64: string;
};

export async function createImmediatePixCharge(input: {
  config: EfiPixConfig;
  txid: string;
  amount: number;
  description: string;
  expirationSeconds?: number;
}): Promise<EfiCobResult> {
  const token = await getEfiAccessToken(input.config);
  const amountStr = input.amount.toFixed(2);

  const cobRes = await efiRequest(
    input.config,
    `/v2/cob/${encodeURIComponent(input.txid)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendario: { expiracao: input.expirationSeconds ?? 3600 },
        valor: { original: amountStr },
        chave: input.config.pixKey,
        solicitacaoPagador: input.description.slice(0, 140),
      }),
    },
  );

  const cob = JSON.parse(cobRes.body) as {
    txid?: string;
    status?: string;
    loc?: { id?: number };
    detail?: string;
    mensagem?: string;
  };

  if (cobRes.status < 200 || cobRes.status >= 300 || !cob.loc?.id) {
    const detail = cob.detail ?? cob.mensagem ?? cobRes.body;
    throw new Error(`Efi cob falhou (${cobRes.status}): ${detail}`);
  }

  const qrRes = await efiRequest(input.config, `/v2/loc/${cob.loc.id}/qrcode`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const qr = JSON.parse(qrRes.body) as { qrcode?: string; imagemQrcode?: string };

  if (qrRes.status < 200 || qrRes.status >= 300 || !qr.qrcode) {
    throw new Error(`Efi QR Code falhou (${qrRes.status}).`);
  }

  return {
    txid: cob.txid ?? input.txid,
    locId: cob.loc.id,
    status: cob.status ?? "ATIVA",
    pixCopyPaste: qr.qrcode,
    qrCodeBase64: qr.imagemQrcode ?? "",
  };
}

export async function getPixChargeStatus(
  config: EfiPixConfig,
  txid: string,
): Promise<{ status: string; paid: boolean }> {
  const token = await getEfiAccessToken(config);
  const res = await efiRequest(config, `/v2/cob/${encodeURIComponent(txid)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = JSON.parse(res.body) as { status?: string };
  const status = data.status ?? "UNKNOWN";
  return { status, paid: status === "CONCLUIDA" };
}
