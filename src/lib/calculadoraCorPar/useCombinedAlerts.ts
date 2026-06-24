import { useCallback, useEffect, useRef, useState } from "react";

export type CombinedAlert = {
  color: "vermelho" | "preto" | null;
  height: "baixo" | "alto" | null;
  confidence: number;
  colorSequenceCount: number;
  heightSequenceCount: number;
  consecutiveColorLosses: number;
  consecutiveHeightLosses: number;
  isActive: boolean;
};

const INACTIVE_COMBINED_ALERT: CombinedAlert = {
  color: null,
  height: null,
  confidence: 0,
  colorSequenceCount: 0,
  heightSequenceCount: 0,
  consecutiveColorLosses: 0,
  consecutiveHeightLosses: 0,
  isActive: false,
};

function getNumberColor(number: number): "vermelho" | "preto" | "neutro" {
  if (number === 0) return "neutro";
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(number) ? "vermelho" : "preto";
}

function getNumberHeight(number: number): "baixo" | "alto" | "neutro" {
  if (number === 0) return "neutro";
  return number <= 18 ? "baixo" : "alto";
}

function getSequenceCount(history: number[], getGroupFn: (num: number) => string) {
  if (history.length < 2) return { group: "", count: 0 };
  const lastNumber = history[history.length - 1]!;
  const lastGroup = getGroupFn(lastNumber);
  if (lastGroup === "neutro") return { group: "", count: 0 };
  let sequenceCount = 1;
  for (let i = history.length - 2; i >= 0; i--) {
    const number = history[i]!;
    const numberGroup = getGroupFn(number);
    if (numberGroup === "neutro") break;
    if (numberGroup === lastGroup) sequenceCount++;
    else break;
  }
  return { group: lastGroup, count: sequenceCount };
}

export function analyzeSequencesFromHistory(history: number[]) {
  if (history.length < 2) {
    return {
      color: null as "vermelho" | "preto" | null,
      height: null as "baixo" | "alto" | null,
      colorSequenceCount: 0,
      heightSequenceCount: 0,
      shouldAlert: false,
    };
  }
  const colorSequence = getSequenceCount(history, getNumberColor);
  const heightSequence = getSequenceCount(history, getNumberHeight);
  const shouldAlert = colorSequence.count >= 2 && heightSequence.count >= 2;
  return {
    color: colorSequence.group as "vermelho" | "preto" | null,
    height: heightSequence.group as "baixo" | "alto" | null,
    colorSequenceCount: colorSequence.count,
    heightSequenceCount: heightSequence.count,
    shouldAlert,
  };
}

function checkAlertResult(number: number, alert: CombinedAlert) {
  if (!alert.isActive || !alert.color || !alert.height)
    return { colorWin: false, heightWin: false };
  const numberColor = getNumberColor(number);
  const numberHeight = getNumberHeight(number);
  if (number === 0) return { colorWin: false, heightWin: false };
  return {
    colorWin: numberColor === alert.color,
    heightWin: numberHeight === alert.height,
  };
}

/**
 * Próximo estado do alerta (puro). Usado para `setState` e para devolver o mesmo objecto ao `addNumber`
 * sem depender da ordem de nested updates.
 */
export function computeNextCombinedAlert(prev: CombinedAlert, history: number[]): CombinedAlert {
  if (history.length === 0) return { ...INACTIVE_COMBINED_ALERT };

  const sequences = analyzeSequencesFromHistory(history);
  const lastNumber = history[history.length - 1]!;

  let newAlert: CombinedAlert = { ...prev };

  if (prev.isActive && prev.color && prev.height) {
    const { colorWin, heightWin } = checkAlertResult(lastNumber, prev);
    if (!colorWin) newAlert.consecutiveColorLosses = prev.consecutiveColorLosses + 1;
    else newAlert.consecutiveColorLosses = 0;
    if (!heightWin) newAlert.consecutiveHeightLosses = prev.consecutiveHeightLosses + 1;
    else newAlert.consecutiveHeightLosses = 0;

    if (newAlert.consecutiveColorLosses === 2) {
      newAlert.color = prev.color === "vermelho" ? "preto" : "vermelho";
      newAlert.consecutiveColorLosses = 0;
    }
    if (newAlert.consecutiveHeightLosses === 2) {
      newAlert.height = prev.height === "baixo" ? "alto" : "baixo";
      newAlert.consecutiveHeightLosses = 0;
    }
  }

  if (sequences.shouldAlert && sequences.color && sequences.height) {
    const confidence = Math.min(
      95,
      Math.max(60, (sequences.colorSequenceCount + sequences.heightSequenceCount) * 10),
    );
    newAlert = {
      ...newAlert,
      color: sequences.color,
      height: sequences.height,
      confidence: Math.round(confidence),
      colorSequenceCount: sequences.colorSequenceCount,
      heightSequenceCount: sequences.heightSequenceCount,
      isActive: true,
    };
  } else {
    newAlert = { ...INACTIVE_COMBINED_ALERT };
  }

  return newAlert;
}

export function useCombinedAlerts() {
  const [currentAlert, setCurrentAlert] = useState<CombinedAlert>({ ...INACTIVE_COMBINED_ALERT });
  const alertRef = useRef<CombinedAlert>({ ...INACTIVE_COMBINED_ALERT });
  useEffect(() => {
    alertRef.current = currentAlert;
  }, [currentAlert]);

  const checkAlertResultCb = useCallback((number: number, alert: CombinedAlert) => {
    return checkAlertResult(number, alert);
  }, []);

  const updateAlert = useCallback((history: number[]) => {
    const next = computeNextCombinedAlert(alertRef.current, history);
    alertRef.current = next;
    setCurrentAlert(next);
    return next;
  }, []);

  const resetAlert = useCallback(() => {
    alertRef.current = { ...INACTIVE_COMBINED_ALERT };
    setCurrentAlert({ ...INACTIVE_COMBINED_ALERT });
  }, []);

  /** Cópia do alerta actual (fim do histórico **antes** do próximo `updateAlert`). Usar para placar / resultado do giro. */
  const getAlertSnapshot = useCallback((): CombinedAlert => {
    return { ...alertRef.current };
  }, []);

  return { currentAlert, updateAlert, resetAlert, checkAlertResult: checkAlertResultCb, getAlertSnapshot };
}
