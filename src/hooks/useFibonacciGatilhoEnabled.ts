import { useEffect, useState } from "react";

import {
  initFibonacciGatilhoFromLocalStorage,
  isFibonacciGatilhoEnabled,
  ROTATING_ROOM_GATILHO_CHANGED_EVENT,
  writeFibonacciGatilhoLocalEnabled,
} from "@/lib/roulette/umFatorTriggerEnable";

export function useFibonacciGatilhoEnabled(): {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
} {
  const [enabled, setEnabledState] = useState(() => {
    initFibonacciGatilhoFromLocalStorage();
    return isFibonacciGatilhoEnabled();
  });

  useEffect(() => {
    const sync = () => setEnabledState(isFibonacciGatilhoEnabled());
    window.addEventListener(ROTATING_ROOM_GATILHO_CHANGED_EVENT, sync);
    return () => window.removeEventListener(ROTATING_ROOM_GATILHO_CHANGED_EVENT, sync);
  }, []);

  const setEnabled = (next: boolean) => {
    writeFibonacciGatilhoLocalEnabled(next);
    setEnabledState(next);
  };

  return {
    enabled,
    setEnabled,
    toggle: () => setEnabled(!isFibonacciGatilhoEnabled()),
  };
}
