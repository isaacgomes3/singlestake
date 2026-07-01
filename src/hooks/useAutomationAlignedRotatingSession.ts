import { useMemo } from "react";

import { useRotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import { useRotatingRoomFibonacciSession } from "@/hooks/useRotatingRoomFibonacciSession";
import {
  useRotatingRoomRotativaSession,
  type RotatingRoomRotativaSession,
} from "@/hooks/useRotatingRoomRotativaSession";
import type { RotatingRoomCrossingSession } from "@/hooks/useRotatingRoomCrossingSession";
import type { RotatingRoomFibonacciSession } from "@/hooks/useRotatingRoomFibonacciSession";
import { useRouletteAutomationSim } from "@/hooks/useRouletteAutomationSim";
import { alignRotatingRoomSessionWithAutomationBet } from "@/lib/roulette/rotatingRoomLobbySignal";

type BaseOptions = {
  /** Evita placar local paralelo quando o motor global SSE está ligado. */
  observeOnly?: boolean;
};

function useObserveOnly(explicit?: boolean): boolean {
  return explicit ?? false;
}

/**
 * Fonte única de indicação: motor servidor (`openBet` / `pendingSignal`) alinhado sobre
 * a vista strategy-global. Sala rotativa, ponte da extensão e painel usam o mesmo caminho.
 */
function useAutomationBet() {
  const { openBet, pendingSignal, revision } = useRouletteAutomationSim();
  const bet = openBet ?? pendingSignal;
  return { openBet, pendingSignal, bet, revision };
}

export function useAutomationAlignedRotativaSession(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  options: BaseOptions = {},
): RotatingRoomRotativaSession {
  const observeOnly = useObserveOnly(options.observeOnly);
  const rawSession = useRotatingRoomRotativaSession(tableIds, histories, {
    preferLocalSession: false,
    observeOnly,
  });
  const { bet } = useAutomationBet();
  return useMemo(
    () => alignRotatingRoomSessionWithAutomationBet(rawSession, bet),
    [rawSession, bet],
  );
}

export function useAutomationAlignedCrossingSession(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  options: BaseOptions & { enabled?: boolean } = {},
): RotatingRoomCrossingSession {
  const observeOnly = useObserveOnly(options.observeOnly);
  const rawSession = useRotatingRoomCrossingSession(tableIds, histories, {
    observeOnly,
    enabled: options.enabled,
  });
  const { bet } = useAutomationBet();
  return useMemo(
    () => alignRotatingRoomSessionWithAutomationBet(rawSession, bet, { roomStrategy: "dois2fatores" }),
    [rawSession, bet],
  );
}

export function useAutomationAlignedFibonacciSession(
  tableIds: readonly number[],
  histories: Record<number, number[]>,
  options: BaseOptions & { enabled?: boolean } = {},
): RotatingRoomFibonacciSession {
  const observeOnly = useObserveOnly(options.observeOnly);
  const rawSession = useRotatingRoomFibonacciSession(tableIds, histories, {
    observeOnly,
    enabled: options.enabled,
  });
  const { bet } = useAutomationBet();
  return useMemo(
    () => alignRotatingRoomSessionWithAutomationBet(rawSession, bet, { roomStrategy: "fibonacci" }),
    [rawSession, bet],
  );
}

/** Re-export para a ponte da extensão e painéis que precisam do bet directo. */
export function useAutomationAlignedBet() {
  return useAutomationBet();
}
