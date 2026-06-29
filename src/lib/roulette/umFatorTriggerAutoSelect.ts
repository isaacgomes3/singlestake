import type { UmFatorTriggerMatchTier } from "@/lib/roulette/umFatorStrategy";
import { isUmFatorTriggerTierEnabled } from "@/lib/roulette/umFatorTriggerEnable";

/** Gale a partir do qual alterna automaticamente para o outro gatilho (recovery 4 = 5.ª entrada). */
export const UM_FATOR_TRIGGER_GALE_SWITCH_AT = 4;

export type UmFatorTriggerAutoSelectFields = {
  /** Gatilho preferido para novas formações (após alternância por gale profundo). */
  autoPreferredTier: UmFatorTriggerMatchTier | null;
  /** Gatilho bloqueado durante a sequência de recovery activa. */
  sequenceLockedTier: UmFatorTriggerMatchTier | null;
};

export function defaultUmFatorTriggerAutoSelectFields(): UmFatorTriggerAutoSelectFields {
  return {
    autoPreferredTier: null,
    sequenceLockedTier: null,
  };
}

export function alternateUmFatorTriggerTier(
  tier: UmFatorTriggerMatchTier,
): UmFatorTriggerMatchTier {
  return tier === "three" ? "two" : "three";
}

export function normalizeUmFatorTriggerAutoSelectFields(
  raw: Partial<UmFatorTriggerAutoSelectFields> | undefined | null,
): UmFatorTriggerAutoSelectFields {
  const tier = (v: unknown): UmFatorTriggerMatchTier | null =>
    v === "two" || v === "three" ? v : null;
  return {
    autoPreferredTier: tier(raw?.autoPreferredTier),
    sequenceLockedTier: tier(raw?.sequenceLockedTier),
  };
}

export type UmFatorTriggerAutoSelectContext = UmFatorTriggerAutoSelectFields & {
  recovery: number;
  lastActiveTriggerTier?: UmFatorTriggerMatchTier | null;
};

/** Tier efectivo durante recovery quando o lock ainda não foi gravado. */
export function resolveUmFatorSequenceLockedTier(
  ctx: UmFatorTriggerAutoSelectContext,
): UmFatorTriggerMatchTier | null {
  if (ctx.sequenceLockedTier != null) return ctx.sequenceLockedTier;
  if (ctx.recovery > 0 && ctx.lastActiveTriggerTier != null) return ctx.lastActiveTriggerTier;
  return null;
}

/**
 * Filtro de gatilhos para detecção:
 * - recovery > 0: só o gatilho da sequência actual (preserva o que está a funcionar);
 * - recovery = 0 + preferência auto: só o gatilho alternado após gale 4+;
 * - caso contrário: respeita activação admin (dois/ três factores).
 */
export function buildUmFatorTriggerTierGate(
  ctx: UmFatorTriggerAutoSelectContext,
  isAdminEnabled: (tier: UmFatorTriggerMatchTier) => boolean = isUmFatorTriggerTierEnabled,
): (tier: UmFatorTriggerMatchTier) => boolean {
  const locked = resolveUmFatorSequenceLockedTier(ctx);

  return (tier) => {
    if (!isAdminEnabled(tier)) return false;
    if (tier === "two") return false;
    if (ctx.recovery > 0 && locked != null) return tier === locked;
    return true;
  };
}

export function applyUmFatorSequenceStart(
  fields: UmFatorTriggerAutoSelectFields,
  recovery: number,
  formationTier: UmFatorTriggerMatchTier | null,
): UmFatorTriggerAutoSelectFields {
  if (formationTier == null) return fields;
  if (recovery > 0 && fields.sequenceLockedTier != null) return fields;
  return { ...fields, sequenceLockedTier: formationTier };
}

export function applyUmFatorSequenceEnd(
  fields: UmFatorTriggerAutoSelectFields,
): UmFatorTriggerAutoSelectFields {
  if (fields.sequenceLockedTier == null) return fields;
  return { ...fields, sequenceLockedTier: null };
}

export function applyUmFatorTriggerSwitchAfterPartialLoss(
  fields: UmFatorTriggerAutoSelectFields,
  _recoveryBefore: number,
  _matchTier: UmFatorTriggerMatchTier | null,
  _nextRecovery: number,
): UmFatorTriggerAutoSelectFields {
  return fields;
}

export function umFatorTriggerAutoSelectLabel(
  fields: UmFatorTriggerAutoSelectFields,
  recovery: number,
): string | null {
  const locked = fields.sequenceLockedTier;
  if (recovery > 0 && locked != null) {
    return locked === "three" ? "3 factores (sequência)" : null;
  }
  return null;
}
