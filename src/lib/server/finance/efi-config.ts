export type EfiPixConfig = {
  clientId: string;
  clientSecret: string;
  pixKey: string;
  certPath: string;
  certPassphrase: string;
  sandbox: boolean;
  webhookUrl: string;
};

export function readEfiPixConfig(): EfiPixConfig | null {
  const clientId = process.env.EFI_PIX_CLIENT_ID?.trim();
  const clientSecret = process.env.EFI_PIX_CLIENT_SECRET?.trim();
  const pixKey = process.env.EFI_PIX_KEY?.trim();
  const certPath = process.env.EFI_PIX_CERT_PATH?.trim();
  if (!clientId || !clientSecret || !pixKey || !certPath) return null;

  const publicUrl = (process.env.PUBLIC_APP_URL ?? "https://stake37.com.br").replace(/\/$/, "");
  return {
    clientId,
    clientSecret,
    pixKey,
    certPath,
    certPassphrase: process.env.EFI_PIX_CERT_PASSPHRASE?.trim() ?? "",
    sandbox: process.env.EFI_PIX_SANDBOX === "1" || process.env.EFI_PIX_SANDBOX === "true",
    webhookUrl: `${publicUrl}/api/webhooks/efi-pix`,
  };
}

export function efiPixApiBase(sandbox: boolean): string {
  return sandbox ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br";
}
