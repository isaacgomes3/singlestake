import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "roulette.doisFatores.exclusaoTapete.placar.v1";

type Stored = {
  wins: number;
  losses: number;
  winStreak: number;
  maxWinStreak: number;
};

function load(): Stored {
  if (typeof window === "undefined") {
    return { wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 };
    const p = JSON.parse(raw) as Partial<Stored>;
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

function save(p: Stored) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function pairKey(pair: readonly [number, number] | null): string {
  if (pair == null) return "";
  return `${pair[0]},${pair[1]}`;
}

/**
 * Placar da **indicação de exclusão no tapete** (dois números): após cada novo giro no espelho,
 * **vitória** se o número mais recente **não** for um dos dois excluídos; **derrota** se for.
 */
export function useExclusionTapetePlacar(
  historyNewestFirst: readonly number[],
  excludedPair: readonly [number, number] | null,
  minGirosParaIndicacao: number,
) {
  const initial = load();
  const [wins, setWins] = useState(() => initial.wins);
  const [losses, setLosses] = useState(() => initial.losses);
  const [winStreak, setWinStreak] = useState(() => initial.winStreak);
  const [maxWinStreak, setMaxWinStreak] = useState(() => initial.maxWinStreak);

  const pendingRef = useRef<{ excluded: Set<number> } | null>(null);
  const prevHeadRef = useRef<number | undefined>(undefined);
  const initializedRef = useRef(false);
  const lastScoredHeadRef = useRef<number | null>(null);
  const prevHadIndicacaoRef = useRef(false);

  useEffect(() => {
    save({ wins, losses, winStreak, maxWinStreak });
  }, [wins, losses, winStreak, maxWinStreak]);

  useEffect(() => {
    if (historyNewestFirst.length === 0) {
      prevHeadRef.current = undefined;
      pendingRef.current = null;
      initializedRef.current = false;
      lastScoredHeadRef.current = null;
      prevHadIndicacaoRef.current = false;
      return;
    }

    const head = historyNewestFirst[0]!;
    const prevHead = prevHeadRef.current;
    const temIndicacao =
      historyNewestFirst.length >= minGirosParaIndicacao && excludedPair != null;

    if (temIndicacao && !prevHadIndicacaoRef.current) {
      lastScoredHeadRef.current = null;
    }
    prevHadIndicacaoRef.current = temIndicacao;

    if (!temIndicacao) {
      prevHeadRef.current = head;
      initializedRef.current = true;
      pendingRef.current = null;
      return;
    }

    const excludedSet = new Set<number>(excludedPair);

    if (
      initializedRef.current &&
      pendingRef.current != null &&
      prevHead !== undefined &&
      head !== prevHead &&
      head !== lastScoredHeadRef.current
    ) {
      const { excluded } = pendingRef.current;
      if (excluded.has(head)) {
        setLosses((lo) => lo + 1);
        setWinStreak(0);
      } else {
        setWins((w) => w + 1);
        setWinStreak((s) => {
          const next = s + 1;
          setMaxWinStreak((m) => Math.max(m, next));
          return next;
        });
      }
      lastScoredHeadRef.current = head;
    }

    prevHeadRef.current = head;
    initializedRef.current = true;
    pendingRef.current = { excluded: excludedSet };
  }, [historyNewestFirst, excludedPair, minGirosParaIndicacao]);

  const resetPlacar = useCallback(() => {
    setWins(0);
    setLosses(0);
    setWinStreak(0);
    setMaxWinStreak(0);
    pendingRef.current = null;
    lastScoredHeadRef.current = null;
    prevHadIndicacaoRef.current = false;
    save({ wins: 0, losses: 0, winStreak: 0, maxWinStreak: 0 });
  }, []);

  return { wins, losses, winStreak, maxWinStreak, resetPlacar };
}
