import { useCallback, useEffect, useRef, useState } from "react";

import type { ShortNeighborGatilhoResult } from "@/lib/roulette/wheelShortChainGatilho";

function gatilhoIdentity(g: ShortNeighborGatilhoResult | null): string {
  if (g == null) return "";
  return `${g.active ? 1 : 0}:${g.center}:${g.lastDistance}`;
}

const STORAGE_KEY = "roulette.wheelShortChain.placar.v1";

type StoredPlacar = {
  wins: number;
  losses: number;
  winStreak: number;
  maxWinStreak: number;
};

function loadPlacar(): StoredPlacar {
  if (typeof window === "undefined") {
    return { wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 };
    const p = JSON.parse(raw) as {
      wins?: number;
      losses?: number;
      winStreak?: number;
      maxWinStreak?: number;
    };
    return {
      wins: Math.max(0, Math.floor(Number(p.wins) || 0)),
      losses: Math.max(0, Math.floor(Number(p.losses) || 0)),
      winStreak: Math.max(0, Math.floor(Number(p.winStreak) || 0)),
      maxWinStreak: Math.max(0, Math.floor(Number(p.maxWinStreak) || 0)),
    };
  } catch {
    return { wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 };
  }
}

function savePlacar(p: StoredPlacar) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Quando o gatilho da zona ±9 está activo, o **próximo** número mais recente no histórico do espelho é avaliado:
 * vitória se cair na zona; derrota caso contrário. Usa o mesmo histórico `newest-first` que alimenta `series` / gatilho.
 */
export function useWheelShortChainPlacar(
  historyNewestFirst: readonly number[],
  gatilho: ShortNeighborGatilhoResult | null,
) {
  const initial = loadPlacar();
  const [wins, setWins] = useState(() => initial.wins);
  const [losses, setLosses] = useState(() => initial.losses);
  const [winStreak, setWinStreak] = useState(() => initial.winStreak);
  const [maxWinStreak, setMaxWinStreak] = useState(() => initial.maxWinStreak);

  const pendingRef = useRef<{ anchor: number; zone: Set<number> } | null>(null);
  const prevHeadRef = useRef<number | undefined>(undefined);
  const initializedRef = useRef(false);
  const lastScoredHeadRef = useRef<number | null>(null);
  const prevGatilhoKeyRef = useRef<string>("");

  useEffect(() => {
    savePlacar({ wins, losses, winStreak, maxWinStreak });
  }, [wins, losses, winStreak, maxWinStreak]);

  useEffect(() => {
    if (historyNewestFirst.length === 0) {
      prevHeadRef.current = undefined;
      pendingRef.current = null;
      initializedRef.current = false;
      lastScoredHeadRef.current = null;
      prevGatilhoKeyRef.current = "";
      return;
    }

    const head = historyNewestFirst[0]!;
    const prevHead = prevHeadRef.current;
    const nowActive = gatilho?.active === true;
    const gKey = gatilhoIdentity(gatilho);
    const prevKey = prevGatilhoKeyRef.current;
    /** Gatilho acabou de passar a activo (ou primeiro render já activo): não bloquear o próximo giro com `lastScoredHead`. */
    const shouldClearLastScored =
      nowActive && (prevKey === "" || !prevKey.startsWith("1:"));
    if (shouldClearLastScored) {
      lastScoredHeadRef.current = null;
    }
    prevGatilhoKeyRef.current = gKey;

    if (
      initializedRef.current &&
      pendingRef.current != null &&
      prevHead !== undefined &&
      head !== prevHead &&
      head !== lastScoredHeadRef.current
    ) {
      const p = pendingRef.current;
      if (p.anchor === prevHead) {
        if (p.zone.has(head)) {
          setWins((w) => w + 1);
          setWinStreak((s) => {
            const next = s + 1;
            setMaxWinStreak((m) => Math.max(m, next));
            return next;
          });
        } else {
          setLosses((lo) => lo + 1);
          setWinStreak(0);
        }
        lastScoredHeadRef.current = head;
      }
    }

    prevHeadRef.current = head;
    initializedRef.current = true;

    if (gatilho?.active) {
      pendingRef.current = { anchor: gatilho.center, zone: new Set(gatilho.zoneNumbers) };
    } else {
      pendingRef.current = null;
    }
  }, [historyNewestFirst, gatilho]);

  const resetPlacar = useCallback(() => {
    setWins(0);
    setLosses(0);
    setWinStreak(0);
    setMaxWinStreak(0);
    pendingRef.current = null;
    lastScoredHeadRef.current = null;
    prevGatilhoKeyRef.current = "";
    savePlacar({ wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 });
  }, []);

  return { wins, losses, winStreak, maxWinStreak, resetPlacar };
}
