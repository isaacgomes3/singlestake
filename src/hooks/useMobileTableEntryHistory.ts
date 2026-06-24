import { useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import {
  mobileFactorsLabel,
  type MobileEntryHistoryItem,
} from "@/lib/roulette/mobileEntryHistory";
import {
  formatMobileLastNumbersChain,
  mobileSignalConfidenceFromBucketGap,
} from "@/lib/roulette/mobileSignalUi";
import type { MobileRoundFlash, MobileTableSessionView } from "@/lib/roulette/mobileTableSessionView";
import type { DoisFatoresFactor } from "@/lib/roulette/doisFatoresStrategy";
import type { StrategyGlobalKind } from "@/lib/roulette/strategyGlobalTypes";

const STORAGE_PREFIX = "roulette.mobile.entryHistory.v1";
const MAX_ENTRIES = 12;

type StoredEntry = {
  ts: number;
  tableId: number;
  won: boolean;
  recovery: number;
  kind: "win" | "loss";
  resultNumber: number;
  factor1?: DoisFatoresFactor;
  factor2?: DoisFatoresFactor;
  triggerNumbers?: number[];
  bucketGap?: number;
};

function storageKey(kind: StrategyGlobalKind, tableId: number): string {
  return `${STORAGE_PREFIX}.${kind}.${tableId}`;
}

function readStored(kind: StrategyGlobalKind, tableId: number): StoredEntry[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(kind, tableId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredEntry[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function writeStored(kind: StrategyGlobalKind, tableId: number, entries: StoredEntry[]): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(storageKey(kind, tableId), JSON.stringify(entries.slice(-MAX_ENTRIES)));
}

function storedToItems(entries: StoredEntry[], singleFactor: boolean): MobileEntryHistoryItem[] {
  return entries
    .slice()
    .reverse()
    .map((entry) => ({
      id: `${entry.ts}-${entry.tableId}-${entry.kind}`,
      ts: entry.ts,
      tableId: entry.tableId,
      won: entry.won,
      recovery: entry.recovery,
      resultNumber: entry.resultNumber,
      factorsLabel: mobileFactorsLabel(entry.factor1, entry.factor2, singleFactor),
      triggerChain: formatMobileLastNumbersChain(entry.triggerNumbers ?? []),
      confidence: mobileSignalConfidenceFromBucketGap(entry.bucketGap ?? 0),
      galeWon: entry.won ? Math.min(entry.recovery + 1, 5) : null,
    }));
}

function recordFlashIfFinal(
  tableId: number,
  kind: StrategyGlobalKind,
  flash: NonNullable<MobileRoundFlash>,
  session: MobileTableSessionView,
  history: readonly number[],
  recoveryBefore: number,
  lastFlashRef: MutableRefObject<string | null>,
  setEntries: Dispatch<SetStateAction<StoredEntry[]>>,
): void {
  const kindResolved = flash.kind ?? (flash.won ? "win" : "recovery");
  if (kindResolved !== "win" && kindResolved !== "loss") return;

  const fingerprint = `${flash.resultNumber}:${kindResolved}:${recoveryBefore}`;
  if (lastFlashRef.current === fingerprint) return;
  lastFlashRef.current = fingerprint;

  const crossing = session.activeCrossing;
  const nextEntry: StoredEntry = {
    ts: Date.now(),
    tableId,
    won: flash.won,
    recovery: recoveryBefore,
    kind: kindResolved,
    resultNumber: flash.resultNumber,
    factor1: crossing?.factor1,
    factor2: crossing?.factor2,
    triggerNumbers: history.slice(0, 4),
    bucketGap: session.alertBucketGap,
  };

  setEntries((prev) => {
    const merged = [...prev, nextEntry].slice(-MAX_ENTRIES);
    writeStored(kind, tableId, merged);
    return merged;
  });
}

export function useMobileTableEntryHistory(
  tableId: number,
  kind: StrategyGlobalKind,
  session: MobileTableSessionView,
  history: readonly number[],
  singleFactor: boolean,
): MobileEntryHistoryItem[] {
  const [entries, setEntries] = useState<StoredEntry[]>(() => readStored(kind, tableId));
  const lastFlashRef = useRef<string | null>(null);
  const recoveryAtFlashRef = useRef(session.currentRecovery);

  useEffect(() => {
    recoveryAtFlashRef.current = session.currentRecovery;
  }, [session.currentRecovery]);

  useEffect(() => {
    setEntries(readStored(kind, tableId));
    lastFlashRef.current = null;
  }, [kind, tableId]);

  useEffect(() => {
    const flash = session.roundFlash;
    if (!flash) return;
    const recoveryBefore = flash.recoveryBefore ?? recoveryAtFlashRef.current;
    recordFlashIfFinal(
      tableId,
      kind,
      flash,
      session,
      history,
      recoveryBefore,
      lastFlashRef,
      setEntries,
    );
  }, [session.roundFlash, session.activeCrossing, session.alertBucketGap, tableId, kind, history, session]);

  return useMemo(() => storedToItems(entries, singleFactor), [entries, singleFactor]);
}
