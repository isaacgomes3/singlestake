import QRCode from "qrcode";

/** Gera imagem PNG (base64 sem prefixo) a partir do payload Pix copia e cola. */
export async function generatePixQrBase64(payload: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(payload, {
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
