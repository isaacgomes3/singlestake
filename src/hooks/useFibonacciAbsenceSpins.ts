import { useEffect, useState } from "react";

import {
  clampFibonacciAbsenceSpins,
  FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT,
  readEffectiveFibonacciAbsenceSpins,
  writeFibonacciAbsenceSpinsLocal,
} from "@/lib/roulette/fibonacciAbsencePrefs";

export function useFibonacciAbsenceSpins(): {
  absenceSpins: number;
  setAbsenceSpins: (next: number) => void;
} {
  const [absenceSpins, setAbsenceSpinsState] = useState(() => readEffectiveFibonacciAbsenceSpins());

  useEffect(() => {
    const sync = () => setAbsenceSpinsState(readEffectiveFibonacciAbsenceSpins());
    window.addEventListener(FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT, sync);
  }, []);

  const setAbsenceSpins = (next: number) => {
    const clamped = clampFibonacciAbsenceSpins(next);
    writeFibonacciAbsenceSpinsLocal(clamped);
    setAbsenceSpinsState(clamped);
  };

  return { absenceSpins, setAbsenceSpins };
}
