import { parseRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import type { ExtensionSourceStatus, ExtensionSyncPayload } from "@/lib/roulette/extensionSyncTypes";
import {
  normalizeUmFatorMachineOnLoad,
  sanitizeUmFatorMachineForTableIds,
  UM_FATOR_MAX_RECOVERY,
  type UmFatorPlacarFlash,
} from "@/lib/roulette/rotatingRoomUmFatorStrategy";

const EXTENSION_TTL_MS = Number.isFinite(Number(process.env.EXTENSION_SYNC_TTL_MS))
  ? Math.max(5_000, Number(process.env.EXTENSION_SYNC_TTL_MS))
  : 45_000;

const MAX_DEDUPE_KEYS = 5_000;

let lastSyncAt = 0;
let lastSeq: number | null = null;
let autopilotRunning = false;
const settlementDedupe = new Set<string>();

export function readExtensionSyncSecret(): string {
  return process.env.EXTENSION_SYNC_SECRET?.trim() ?? "";
}

export function isExtensionSyncConfigured(): boolean {
  return readExtensionSyncSecret().length > 0;
}

export function verifyExtensionSyncSecret(secret: unknown): boolean {
  const expected = readExtensionSyncSecret();
  if (!expected) return false;
  return typeof secret === "string" && secret === expected;
}

export function isExtensionSourceActive(): boolean {
  return lastSyncAt > 0 && Date.now() - lastSyncAt < EXTENSION_TTL_MS;
}

export function getExtensionSourceStatus(): ExtensionSourceStatus {
  return {
    active: isExtensionSourceActive(),
    lastSyncAt: lastSyncAt > 0 ? lastSyncAt : null,
    lastSeq,
    autopilotRunning,
  };
}

export function rememberExtensionSettlementKey(key: string): boolean {
  if (settlementDedupe.has(key)) return false;
  settlementDedupe.add(key);
  if (settlementDedupe.size > MAX_DEDUPE_KEYS) {
    const drop = settlementDedupe.size - MAX_DEDUPE_KEYS;
    let i = 0;
    for (const k of settlementDedupe) {
      settlementDedupe.delete(k);
      if (++i >= drop) break;
    }
  }
  return true;
}

export function touchExtensionSource(payload: Pick<ExtensionSyncPayload, "seq" | "autopilotRunning">): void {
  lastSyncAt = Date.now();
  lastSeq = payload.seq;
  autopilotRunning = payload.autopilotRunning === true;
}

export function parseExtensionSyncPayload(raw: unknown): ExtensionSyncPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<ExtensionSyncPayload>;
  if (o.version !== 1) return null;
  if (typeof o.secret !== "string") return null;
  if (!Array.isArray(o.tableIds) || o.tableIds.length === 0) return null;
  if (!o.histories || typeof o.histories !== "object") return null;
  if (!o.machine || typeof o.machine !== "object") return null;
  if (!o.stats || typeof o.stats !== "object") return null;
  const tableIds = o.tableIds
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (tableIds.length === 0) return null;

  const histories: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(o.histories as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    histories[key] = value
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 36);
  }

  const maxRecovery =
    typeof o.maxRecovery === "number" && Number.isFinite(o.maxRecovery)
      ? Math.min(6, Math.max(0, Math.floor(o.maxRecovery)))
      : UM_FATOR_MAX_RECOVERY;

  const settlements = Array.isArray(o.settlements)
    ? o.settlements
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const s = item as Partial<ExtensionSyncPayload["settlements"]>[number];
          const flash = s?.flash;
          if (!flash || typeof flash !== "object") return null;
          const f = flash as NonNullable<UmFatorPlacarFlash>;
          if (
            typeof f.resultNumber !== "number" ||
            typeof f.tableId !== "number" ||
            (f.kind !== "win" && f.kind !== "loss" && f.kind !== "recovery")
          ) {
            return null;
          }
          const recoveryBefore = Math.max(0, Math.floor(Number(s.recoveryBefore) || 0));
          const stakeRaw = Number(s.stake);
          const stake =
            Number.isFinite(stakeRaw) && stakeRaw > 0
              ? stakeRaw
              : 0.5 * 2 ** Math.min(Math.max(0, recoveryBefore), maxRecovery);
          const dedupeKey =
            typeof s.dedupeKey === "string" && s.dedupeKey.trim()
              ? s.dedupeKey.trim()
              : `${f.tableId}:${f.resultNumber}:${f.kind}:${recoveryBefore}`;
          return { recoveryBefore, flash: f, stake, dedupeKey };
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
    : [];

  return {
    version: 1,
    secret: o.secret,
    seq: Math.max(0, Math.floor(Number(o.seq) || 0)),
    updatedAt: Math.max(0, Math.floor(Number(o.updatedAt) || Date.now())),
    autopilotRunning: o.autopilotRunning === true,
    tableIds,
    histories,
    machine: o.machine as ExtensionSyncPayload["machine"],
    stats: parseRotatingRoomSessionStats(o.stats, maxRecovery),
    maxRecovery,
    settlements,
  };
}

export function applyExtensionMachineToState(
  tableIds: readonly number[],
  machine: ExtensionSyncPayload["machine"],
  stats: ExtensionSyncPayload["stats"],
): ReturnType<typeof sanitizeUmFatorMachineForTableIds> {
  return sanitizeUmFatorMachineForTableIds(
    normalizeUmFatorMachineOnLoad(machine, stats),
    tableIds,
  );
}

export { EXTENSION_TTL_MS };
