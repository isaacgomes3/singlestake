import { isValidCpf } from "@/lib/server/finance/cpf";
import {
  getPaymentGatewaySettings,
  isLucPagueiGatewayReady,
  type WithdrawalMode,
} from "@/lib/server/finance/payment-gateway-settings";

export async function getWithdrawalMode(): Promise<WithdrawalMode> {
  const settings = await getPaymentGatewaySettings();
  return settings.withdrawalMode;
}

/** Gateway automático só quando modo «automático até limite», gateway activo, CPF válido e valor dentro do limite. */
export async function shouldAutoSendWithdrawalViaGateway(input: {
  amount: number;
  userCpf: string | null;
}): Promise<boolean> {
  const settings = await getPaymentGatewaySettings();
  if (settings.withdrawalMode !== "automatic_up_to_limit") return false;
  if (!(await isLucPagueiGatewayReady())) return false;
  if (!input.userCpf || !isValidCpf(input.userCpf)) return false;
  if (!Number.isFinite(input.amount) || input.amount <= 0) return false;
  return input.amount <= settings.withdrawalAutoLimit;
}
