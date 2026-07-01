import { useEffect, useState } from "react";

import {
  FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT,
  readEffectiveFibonacciZoneAbsenceSpins,
  type FibonacciZoneAbsenceSpins,
  writeFibonacciZoneAbsenceSpinsLocal,
} from "@/lib/roulette/fibonacciAbsencePrefs";

export function useFibonacciAbsenceSpins(): {
  absenceSpins: number;
  absenceByZone: FibonacciZoneAbsenceSpins;
  setAbsenceByZone: (next: FibonacciZoneAbsenceSpins) => void;
} {
  const [absenceByZone, setAbsenceByZoneState] = useState(() =>
    readEffectiveFibonacciZoneAbsenceSpins(),
  );

  useEffect(() => {
    const sync = () => setAbsenceByZoneState(readEffectiveFibonacciZoneAbsenceSpins());
    window.addEventListener(FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(FIBONACCI_ABSENCE_SPINS_CHANGED_EVENT, sync);
  }, []);

  const setAbsenceByZone = (next: FibonacciZoneAbsenceSpins) => {
    writeFibonacciZoneAbsenceSpinsLocal(next);
    setAbsenceByZoneState(next);
  };

  return {
    absenceSpins: Math.max(absenceByZone.dozen, absenceByZone.column),
    absenceByZone,
    setAbsenceByZone,
  };
}
