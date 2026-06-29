import {
  isPixEmvPayload,
  isPixEmvPayloadStrict,
  normalizePixEmvPayload,
  parsePixPayloadAmount,
} from "@/lib/server/finance/pix-qr";

/** Variáveis de ambiente por valor fixo (Pacote Start R$ 50, Automação R$ 250, etc.). */
const STATIC_PIX_ENV_BY_AMOUNT: Record<number, string> = {
  50: "PIX_COPIA_COLA_50",
  250: "PIX_COPIA_COLA_250",
};

function readEnvPixPayload(key: string): string | null {
  const raw = process.env[key]?.trim();
  if (!raw) return null;
  const normalized = normalizePixEmvPayload(raw);
  return isPixEmvPayloadStrict(normalized) ? normalized : isPixEmvPayload(normalized) ? normalized : null;
}

/** Pix copia e cola fixo (Bradesco, Poupex, etc.) — legado, um único código. */
export function readStaticPixCopiaCola(): string | null {
  return readEnvPixPayload("PIX_COPIA_COLA");
}

/** Código estático para o valor exacto do pacote, se configurado. */
export function readStaticPixCopiaColaForAmount(amount: number): string | null {
  const rounded = Math.round(amount * 100) / 100;

  const amountKey = STATIC_PIX_ENV_BY_AMOUNT[rounded];
  if (amountKey) {
    const specific = readEnvPixPayload(amountKey);
    if (specific) return specific;
  }

  const legacy = readStaticPixCopiaCola();
  if (!legacy) return null;

  const fixed = parsePixPayloadAmount(legacy);
  if (fixed == null || Math.abs(fixed - rounded) < 0.009) return legacy;

  return null;
}

export function isStaticPixConfigured(): boolean {
  if (readStaticPixCopiaCola()) return true;
  return Object.values(STATIC_PIX_ENV_BY_AMOUNT).some((key) => readEnvPixPayload(key) != null);
}

/** Valores com QR estático configurado no servidor (para mensagens de erro). */
export function listConfiguredStaticPixAmounts(): number[] {
  const amounts: number[] = [];
  for (const [amount, envKey] of Object.entries(STATIC_PIX_ENV_BY_AMOUNT)) {
    if (readEnvPixPayload(envKey)) amounts.push(Number(amount));
  }
  const legacy = readStaticPixCopiaCola();
  if (legacy) {
    const fixed = parsePixPayloadAmount(legacy);
    if (fixed != null && !amounts.some((a) => Math.abs(a - fixed) < 0.009)) {
      amounts.push(fixed);
    }
  }
  return amounts.sort((a, b) => a - b);
}
