import QRCode from "qrcode";

/** Remove espaços/quebras — PIX copia e cola deve ser uma linha contínua. */
export function normalizePixEmvPayload(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

/** CRC16-CCITT-FALSE (padrão EMVCo / PIX Bacen) sobre bytes UTF-8. */
export function computePixEmvCrc16(payload: string): string {
  let crc = 0xffff;
  const polynom = 0x1021;
  const bytes = Buffer.from(payload, "utf8");
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]! << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynom) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function hasPixEmvShape(raw: string): boolean {
  const s = normalizePixEmvPayload(raw);
  if (!s.startsWith("000201")) return false;
  if (s.length < 50 || s.length > 512) return false;
  return /6304[0-9A-Fa-f]{4}$/.test(s);
}

/** Valida checksum CRC do payload (campo 63) — informativo; gateways podem usar variantes aceites pelos bancos. */
export function validatePixEmvCrc(emv: string): boolean {
  const s = normalizePixEmvPayload(emv);
  const crcTag = s.lastIndexOf("6304");
  if (crcTag < 0 || crcTag + 8 !== s.length) return false;
  const payloadForCrc = s.slice(0, crcTag + 4);
  const crcGiven = s.slice(crcTag + 4);
  if (!/^[0-9A-Fa-f]{4}$/.test(crcGiven)) return false;
  return computePixEmvCrc16(payloadForCrc) === crcGiven.toUpperCase();
}

/**
 * Payload EMV utilizável (copia e cola).
 * Não exige CRC local — o Luc Paguei devolve EMV válido para o banco mesmo quando o CRC
 * calculado aqui difere (variante EMVCo). Rejeitar só formatos claramente inválidos.
 */
export function isPixEmvPayload(raw: string): boolean {
  return hasPixEmvShape(raw);
}

/** Validação estrita com CRC — útil para PIX estático configurado manualmente no .env. */
export function isPixEmvPayloadStrict(raw: string): boolean {
  if (!hasPixEmvShape(raw)) return false;
  if (!validatePixEmvCrc(raw)) {
    console.warn("[pix-qr] payload EMV com CRC que não confere com CCITT-FALSE local");
    return false;
  }
  return true;
}

export function normalizePixEmvFromGateway(raw: string): string | null {
  const s = normalizePixEmvPayload(raw);
  if (!isPixEmvPayload(s)) return null;
  if (!validatePixEmvCrc(s)) {
    console.info("[pix-qr] EMV do gateway aceite (formato válido; CRC local difere)");
  }
  return s;
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

/** Sempre gera QR a partir do EMV — nunca reutiliza imagem do gateway (pode codificar payload diferente). */
export async function buildPixQrArtifactsFromEmv(
  emvRaw: string,
): Promise<{ emv: string; qrCodeBase64: string }> {
  const emv = normalizePixEmvPayload(emvRaw);
  if (!isPixEmvPayload(emv)) {
    throw new Error("Payload PIX inválido — código copia e cola EMV esperado.");
  }
  const qrCodeBase64 = await generatePixQrBase64(emv);
  return { emv, qrCodeBase64 };
}

/** Extrai valor fixo (campo EMV 54) do payload, se existir. */
export function parsePixPayloadAmount(payload: string): number | null {
  const match = payload.match(/54(\d{2})([\d.]+)/);
  if (!match?.[2]) return null;
  const amount = Number.parseFloat(match[2]);
  return Number.isFinite(amount) ? amount : null;
}
