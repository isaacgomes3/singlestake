import type { PragmaticExteriorBetKey } from "@/lib/roulette/pragmaticExteriorBetMap";
import type { RotatingRoomPhase } from "@/lib/roulette/rotatingRoomStrategy";

/** Estado da sala rotativa 1 Fator exposto ao simulador. */
export type RotatingRoomSimulatorIndication = {
  revision: number;
  updatedAt: number;
  strategy: "um1fator";
  phase: RotatingRoomPhase;
  /** Texto principal (ex.: «Aguarde no Lobby» ou «Macao · Vermelho»). */
  lobbyMessage: string;
  hasSignal: boolean;
  showTapeteSignal: boolean;
  tableId: number | null;
  tableLabel: string | null;
  aproveitamentoPct: number;
  wins: number;
  losses: number;
  recovery: number;
  /** Valor sugerido da aposta (base × 2^recovery). */
  suggestedStake: number;
  alertLabel: string | null;
  betExteriorKey: PragmaticExteriorBetKey | null;
  /** Identificador estável do sinal activo — evita apostar duas vezes no mesmo sinal. */
  signalId: string | null;
  action: "wait" | "bet";
};

export type RotatingRoomSimulatorStreamMessage =
  | { type: "sync"; indication: RotatingRoomSimulatorIndication }
  | {
      type: "update";
      revision: number;
      indication: RotatingRoomSimulatorIndication;
    };
