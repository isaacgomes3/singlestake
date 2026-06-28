import QRCode from "qrcode";

/** Remove espaços/quebras — PIX copia e cola deve ser uma linha contínua. */
export function normalizePixEmvPayload(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

/** Payload EMV válido (copia e cola) — bancos rejeitam URL, base64 de imagem, etc. */
export function isPixEmvPayload(raw: string): boolean {
  const s = normalizePixEmvPayload(raw);
  if (!s.startsWith("000201")) return false;
  if (s.length < 50 || s.length > 512) return false;
  return /6304[0-9A-Fa-f]{4}$/.test(s);
}

/** Se o gateway devolver o EMV em base64 (campo pixCodeBase64), decodifica. */
export function decodePixEmvFromBase64(raw: string): string | null {
  const trimmed = raw.trim();
  if (isPixEmvPayload(trimmed)) return normalizePixEmvPayload(trimmed);
  if (!/^[A-Za-z0-9+/=]+$/.test(trimmed) || trimmed.length < 24) return null;
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (isPixEmvPayload(decoded)) return normalizePixEmvPayload(decoded);
  } catch {
    /* não é base64 válido */
  }
  return null;
}

/** Gera imagem PNG (base64 sem prefixo) a partir do payload Pix copia e cola. */
export async function generatePixQrBase64(payload: string): Promise<string> {
  const emv = normalizePixEmvPayload(payload);
  if (!isPixEmvPayload(emv)) {
    throw new Error("Payload PIX inválido — código copia e cola EMV esperado.");
  }
  const dataUrl = await QRCode.toDataURL(emv, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    type: "image/png",
  });
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

/** Extrai valor fixo (campo EMV 54) do payload, se existir. */
export function parsePixPayloadAmount(payload: string): number | null {
  const match = payload.match(/54(\d{2})([\d.]+)/);
  if (!match?.[2]) return null;
  const amount = Number.parseFloat(match[2]);
  return Number.isFinite(amount) ? amount : null;
}
