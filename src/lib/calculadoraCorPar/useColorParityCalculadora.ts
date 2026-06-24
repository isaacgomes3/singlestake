import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useCombinedAlerts, type CombinedAlert } from "@/lib/calculadoraCorPar/useCombinedAlerts";

export interface CombinedAlertResult {
  alertType: "combinado";
  targetColor: string;
  targetHeight: string;
  targetGroup: string;
  actualNumber: number;
  isColorWin: boolean;
  isHeightWin: boolean;
  isWin: boolean;
  timestamp: number;
  sequenceCount: number;
}

export interface ColorParityState {
  history: number[];
  /** Vitória: indicação activa e acerta cor e altura no mesmo giro. */
  totalWins: number;
  /** Derrota: só quando a indicação erra os dois factores (cor e altura) no mesmo giro. */
  totalLosses: number;
  convergentCount: number;
  divergentCount: number;
  lastState: "convergent" | "divergent" | null;
  hasFirstComparison: boolean;
  heightSequenceCount: number;
  colorSequenceCount: number;
  heightScore: number;
  colorScore: number;
  alertResults: CombinedAlertResult[];
  currentAlert: {
    type: "combinado" | null;
    targetGroup: string | null;
    targetNumbers: number[] | null;
    confidence: number;
    sequenceCount: number;
  };
  audioEnabled: boolean;
  highlightedChart: "cor" | "altura" | null;
}

const initialAlert = {
  type: null,
  targetGroup: null,
  targetNumbers: null,
  confidence: 0,
  sequenceCount: 0,
} as const;

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

function getNumberHeightSeq(n: number): "baixo" | "alto" | "neutro" {
  if (n === 0) return "neutro";
  return n <= 18 ? "baixo" : "alto";
}

function getNumberColorSeq(n: number): "vermelho" | "preto" | "neutro" {
  if (n === 0) return "neutro";
  const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return red.includes(n) ? "vermelho" : "preto";
}

function countSequenceForCategory(history: number[], category: "altura" | "cor"): number {
  if (history.length < 1) return 0;
  const getGroup = category === "altura" ? getNumberHeightSeq : getNumberColorSeq;
  const lastNumber = history[history.length - 1]!;
  const lastGroup = getGroup(lastNumber);
  if (lastGroup === "neutro") return 0;
  let sequenceCount = 1;
  for (let i = history.length - 2; i >= 0; i--) {
    const number = history[i]!;
    const numberGroup = getGroup(number);
    if (numberGroup === "neutro") break;
    if (numberGroup === lastGroup) sequenceCount++;
    else break;
  }
  return sequenceCount;
}

function heightLabel(h: "baixo" | "alto"): string {
  return h === "baixo" ? "BAIXO" : "ALTO";
}

export function useColorParityCalculadora() {
  const combinedHooks = useCombinedAlerts();
  const {
    updateAlert: updateCombinedAlert,
    resetAlert: resetCombinedAlert,
    checkAlertResult,
    getAlertSnapshot,
  } = combinedHooks;

  const [state, setState] = useState<ColorParityState>({
    history: [],
    totalWins: 0,
    totalLosses: 0,
    convergentCount: 0,
    divergentCount: 0,
    lastState: null,
    hasFirstComparison: false,
    heightSequenceCount: 0,
    colorSequenceCount: 0,
    heightScore: 0,
    colorScore: 0,
    alertResults: [],
    currentAlert: { ...initialAlert },
    audioEnabled: true,
    highlightedChart: null,
  });

  const speakAlert = useCallback((alertText: string, audioEnabled: boolean) => {
    if (!audioEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(alertText);
    utterance.lang = "pt-BR";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }, []);

  const createGridLayout = useCallback((history: number[]) => {
    const rows = 2;
    const cols = 6;
    const cap = rows * cols;
    const grid: (number | null)[][] = [
      Array(cols).fill(null),
      Array(cols).fill(null),
    ];
    const n = Math.min(history.length, cap);
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / cols);
      const col = k % cols;
      grid[row]![col] = history[history.length - 1 - k]!;
    }
    return grid;
  }, []);

  const addNumber = useCallback(
    (number: number, options?: { skipToasts?: boolean }) => {
      const skipToasts = options?.skipToasts === true;
      /** Indicação válida para **este** giro = estado antes de recalcular com o número novo (senão o alvo cola no sufixo pós-giro). */
      const alertAntesDoGiro = getAlertSnapshot();
      setState((prev) => {
        const newHistory = [...prev.history, number];
        const updatedCombinedAlert = (updateCombinedAlert(newHistory) ?? INACTIVE_COMBINED_ALERT) as CombinedAlert;

        const heightSequenceCount = countSequenceForCategory(newHistory, "altura");
        const colorSequenceCount = countSequenceForCategory(newHistory, "cor");

        const updatedData = {
          heightScore: prev.heightScore,
          colorScore: prev.colorScore,
          totalWins: prev.totalWins,
          totalLosses: prev.totalLosses,
        };
        const newAlertResults = [...prev.alertResults];
        let currentAlert = prev.currentAlert;

        const activeAlert = updatedCombinedAlert;

        if (alertAntesDoGiro.isActive && alertAntesDoGiro.color && alertAntesDoGiro.height) {
          const { colorWin, heightWin } = checkAlertResult(number, alertAntesDoGiro);
          const overallWin = colorWin && heightWin;

          newAlertResults.push({
            alertType: "combinado",
            targetColor: alertAntesDoGiro.color,
            targetHeight: alertAntesDoGiro.height,
            targetGroup: `${alertAntesDoGiro.color}-${alertAntesDoGiro.height}`,
            actualNumber: number,
            isColorWin: colorWin,
            isHeightWin: heightWin,
            isWin: overallWin,
            timestamp: Date.now(),
            sequenceCount:
              alertAntesDoGiro.colorSequenceCount + alertAntesDoGiro.heightSequenceCount,
          });

          if (overallWin) {
            updatedData.totalWins = prev.totalWins + 1;
            updatedData.colorScore = Math.max(0, prev.colorScore + 1);
            updatedData.heightScore = Math.max(0, prev.heightScore + 1);
            if (!skipToasts) {
              toast.success("Alerta combinado: vitória", {
                description: `Previa ${alertAntesDoGiro.color}-${heightLabel(alertAntesDoGiro.height)}, saiu ${number}`,
              });
            }
          } else {
            const fullMiss = !colorWin && !heightWin;
            if (fullMiss) {
              updatedData.totalLosses = prev.totalLosses + 1;
            }
            updatedData.colorScore = Math.max(0, prev.colorScore - 0.5);
            updatedData.heightScore = Math.max(0, prev.heightScore - 0.5);
            const resultText = colorWin
              ? "Cor acertou, altura não"
              : heightWin
                ? "Altura acertou, cor não"
                : "Cor e altura não";
            if (!skipToasts) {
              if (fullMiss) {
                toast.warning("Alerta combinado: derrota (contador)", { description: resultText });
              } else {
                toast.info("Alerta combinado: parcial", {
                  description: `${resultText} — não conta como derrota no placar (falhou só um factor).`,
                });
              }
            }
          }
        }

        if (activeAlert.isActive && activeAlert.color && activeAlert.height) {
          const newTargetGroup = `${activeAlert.color}-${activeAlert.height}`;
          currentAlert = {
            type: "combinado",
            targetGroup: newTargetGroup,
            targetNumbers: [],
            confidence: activeAlert.confidence,
            sequenceCount: activeAlert.colorSequenceCount + activeAlert.heightSequenceCount,
          };
          const alertText = `Alerta combinado: ${activeAlert.color} e ${activeAlert.height}. Confiança: ${activeAlert.confidence}%`;
          if (!prev.currentAlert.type || prev.currentAlert.targetGroup !== newTargetGroup) {
            if (!skipToasts) {
              toast.info("Alerta actualizado", {
                description: `${activeAlert.color.toUpperCase()}-${heightLabel(activeAlert.height)} · ${activeAlert.confidence}%`,
              });
            }
            if (prev.audioEnabled && !skipToasts) {
              setTimeout(() => speakAlert(alertText, prev.audioEnabled), 100);
            }
          }
        } else {
          currentAlert = { ...initialAlert };
        }

        return {
          ...prev,
          ...updatedData,
          history: newHistory,
          hasFirstComparison: newHistory.length >= 2,
          heightSequenceCount,
          colorSequenceCount,
          alertResults: newAlertResults,
          currentAlert,
          highlightedChart: null,
        };
      });
    },
    [updateCombinedAlert, checkAlertResult, speakAlert, getAlertSnapshot],
  );

  const removeLastNumber = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) return prev;
      const newHistory = prev.history.slice(0, -1);
      updateCombinedAlert(newHistory);
      return {
        ...prev,
        history: newHistory,
        hasFirstComparison: newHistory.length >= 2,
        heightSequenceCount: countSequenceForCategory(newHistory, "altura"),
        colorSequenceCount: countSequenceForCategory(newHistory, "cor"),
        highlightedChart: null,
      };
    });
  }, [updateCombinedAlert]);

  const clearAll = useCallback(() => {
    resetCombinedAlert();
    setState({
      history: [],
      totalWins: 0,
      totalLosses: 0,
      convergentCount: 0,
      divergentCount: 0,
      lastState: null,
      hasFirstComparison: false,
      heightSequenceCount: 0,
      colorSequenceCount: 0,
      heightScore: 0,
      colorScore: 0,
      alertResults: [],
      currentAlert: { ...initialAlert },
      audioEnabled: true,
      highlightedChart: null,
    });
  }, [resetCombinedAlert]);

  const toggleAudio = useCallback(() => {
    setState((prev) => ({ ...prev, audioEnabled: !prev.audioEnabled }));
  }, []);

  const getGridLayout = useCallback(
    () => createGridLayout(state.history),
    [state.history, createGridLayout],
  );

  const updateWithMLPredictions = useCallback(() => {}, []);

  return {
    state,
    /** Estado real do alerta combinado (use na UI; `state.currentAlert` pode ficar dessincronizado em repetições em massa). */
    combinedAlert: combinedHooks.currentAlert,
    addNumber,
    removeLastNumber,
    clearAll,
    toggleAudio,
    getGridLayout,
    updateWithMLPredictions,
  };
}
