import { getPaymentGatewaySettings } from "@/lib/server/finance/payment-gateway-settings";

/**
 * Confirmação de pagamentos PIX (pacotes e depósitos).
 * Por defeito só o administrador activa/credita — o webhook regista o evento mas não conclui o pedido.
 * Desactive «Confirmação manual PIX» no admin ou defina PIX_AUTO_GATEWAY_CONFIRM=1 para legado automático.
 */
export async function isPixManualConfirmationOnly(): Promise<boolean> {
  if (process.env.PIX_AUTO_GATEWAY_CONFIRM === "1") return false;
  const settings = await getPaymentGatewaySettings();
  return settings.pixManualConfirmation !== false;
}
