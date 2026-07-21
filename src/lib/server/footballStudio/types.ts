import type { FootballStudioRound, FootballStudioSide } from "@/lib/evolution/footballStudioSidePatterns";
import type { FootballStudioEcoSignal } from "@/lib/evolution/footballStudioEcoStrategy";
import type { TopCardParsedCard, TopCardRound } from "@/lib/evolution/topCardEvoParser";

export type FootballStudioHubCardRound = TopCardRound & {
  at?: number;
};

export type FootballStudioDisplayRound = FootballStudioRound & {
  home?: TopCardParsedCard | null;
  away?: TopCardParsedCard | null;
  evoGameId?: string | null;
  bridgeOnly?: boolean;
  at?: number;
};

export type FootballStudioHubSnapshot = {
  ok: true;
  channel: string;
  bridgeStatus: "idle" | "ok" | "error" | "no-key";
  lastError: string | null;
  updatedAt: string | null;
  history: FootballStudioRound[];
  displayRounds: FootballStudioDisplayRound[];
  cardHistory: FootballStudioHubCardRound[];
  lastCards: FootballStudioHubCardRound | null;
  cardsWithSuits: number;
  note: string;
  /** Alerta Eco: cor à esquerda da coincidência (2 ocorrências 100%). */
  ecoSignal: FootballStudioEcoSignal | null;
};

export type FootballStudioHubMessage =
  | { type: "ready"; snapshot: FootballStudioHubSnapshot }
  | { type: "snapshot"; snapshot: FootballStudioHubSnapshot }
  | { type: "bridge-round"; round: FootballStudioRound }
  | { type: "cards"; round: FootballStudioHubCardRound }
  | { type: "status"; bridgeStatus: FootballStudioHubSnapshot["bridgeStatus"]; message?: string };

export function isFootballStudioSide(value: unknown): value is FootballStudioSide {
  return value === "home" || value === "away" || value === "draw";
}
