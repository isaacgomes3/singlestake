import { colorOf } from "@/lib/roulette/streetPairTrigger";
import { streetIdForNumber } from "@/lib/roulette/streetStrategy";

/** Aposta numa área do tapete europeu (0–36). */
export type RouletteBetKind =
  | { type: "straight"; num: number }
  | { type: "street"; id: number }
  /** Duas ruas adjacentes (6 números) — linha / sixain. Id 1 = ruas 1+2 … 11 = ruas 11+12. */
  | { type: "line"; id: number }
  | { type: "dozen"; id: 1 | 2 | 3 }
  | { type: "low" }
  | { type: "high" }
  | { type: "even" }
  | { type: "odd" }
  | { type: "red" }
  | { type: "black" };

export type PlacedRouletteBet = {
  area: RouletteBetKind;
  chips: number;
};

export type RouletteBetSettlementLine = {
  area: RouletteBetKind;
  chips: number;
  won: boolean;
  returned: number;
  net: number;
};

export type RouletteRoundSettlement = {
  spin: number;
  totalStaked: number;
  totalReturned: number;
  netProfit: number;
  winCount: number;
  lossCount: number;
  lines: RouletteBetSettlementLine[];
};

/** Multiplicador bruto (inclui a ficha apostada). Ex.: straight = 36×, paridade = 2×. */
export function betPayoutMultiplier(bet: RouletteBetKind): number {
  switch (bet.type) {
    case "straight":
      return 36;
    case "street":
      return 12;
    case "line":
      return 7;
    case "dozen":
      return 3;
    default:
      return 2;
  }
}

export function betAreaKey(bet: RouletteBetKind): string {
  switch (bet.type) {
    case "straight":
      return `s:${bet.num}`;
    case "street":
      return `st:${bet.id}`;
    case "line":
      return `ln:${bet.id}`;
    case "dozen":
      return `d:${bet.id}`;
    case "low":
      return "low";
    case "high":
      return "high";
    case "even":
      return "even";
    case "odd":
      return "odd";
    case "red":
      return "red";
    case "black":
      return "black";
  }
}

export function parseBetAreaKey(key: string): RouletteBetKind | null {
  if (key === "low") return { type: "low" };
  if (key === "high") return { type: "high" };
  if (key === "even") return { type: "even" };
  if (key === "odd") return { type: "odd" };
  if (key === "red") return { type: "red" };
  if (key === "black") return { type: "black" };
  if (key.startsWith("s:")) {
    const n = Number(key.slice(2));
    if (Number.isInteger(n) && n >= 0 && n <= 36) return { type: "straight", num: n };
  }
  if (key.startsWith("st:")) {
    const id = Number(key.slice(3));
    if (Number.isInteger(id) && id >= 1 && id <= 12) return { type: "street", id };
  }
  if (key.startsWith("ln:")) {
    const id = Number(key.slice(3));
    if (Number.isInteger(id) && id >= 1 && id <= 11) return { type: "line", id };
  }
  if (key.startsWith("d:")) {
    const id = Number(key.slice(2));
    if (id === 1 || id === 2 || id === 3) return { type: "dozen", id };
  }
  return null;
}

/** Rótulo curto para a área apostada. */
export function betAreaLabel(bet: RouletteBetKind): string {
  switch (bet.type) {
    case "straight":
      return `Nº ${bet.num}`;
    case "street":
      return `Rua ${bet.id}`;
    case "line":
      return `Linha ${bet.id}–${bet.id + 1}`;
    case "dozen":
      return `${bet.id}.ª 12`;
    case "low":
      return "Baixo 1–18";
    case "high":
      return "Alto 19–36";
    case "even":
      return "Pares";
    case "odd":
      return "Ímpares";
    case "red":
      return "Vermelho";
    case "black":
      return "Preto";
  }
}

/** Verdadeiro se o número sorteado paga esta aposta. */
export function betCoversNumber(bet: RouletteBetKind, num: number): boolean {
  switch (bet.type) {
    case "straight":
      return num === bet.num;
    case "street": {
      const sid = streetIdForNumber(num);
      return sid !== null && sid === bet.id;
    }
    case "line": {
      const sid = streetIdForNumber(num);
      return sid !== null && (sid === bet.id || sid === bet.id + 1);
    }
    case "dozen":
      if (num < 1 || num > 36) return false;
      if (bet.id === 1) return num <= 12;
      if (bet.id === 2) return num >= 13 && num <= 24;
      return num >= 25;
    case "low":
      return num >= 1 && num <= 18;
    case "high":
      return num >= 19 && num <= 36;
    case "even":
      return num !== 0 && num % 2 === 0;
    case "odd":
      return num !== 0 && num % 2 === 1;
    case "red":
      return num !== 0 && colorOf(num) === "Vermelho";
    case "black":
      return num !== 0 && colorOf(num) === "Preto";
  }
}

/** Liquida apostas contra um giro real. */
export function settleRouletteBets(
  spin: number,
  bets: readonly PlacedRouletteBet[],
): RouletteRoundSettlement {
  const lines: RouletteBetSettlementLine[] = [];
  let totalStaked = 0;
  let totalReturned = 0;
  let winCount = 0;
  let lossCount = 0;

  for (const { area, chips } of bets) {
    if (chips <= 0) continue;
    totalStaked += chips;
    const won = betCoversNumber(area, spin);
    const returned = won ? chips * betPayoutMultiplier(area) : 0;
    const net = returned - chips;
    if (won) winCount += 1;
    else lossCount += 1;
    totalReturned += returned;
    lines.push({ area, chips, won, returned, net });
  }

  return {
    spin,
    totalStaked,
    totalReturned,
    netProfit: totalReturned - totalStaked,
    winCount,
    lossCount,
    lines,
  };
}

/** Agrupa fichas por área (chave estável). */
export function mergePlacedBets(bets: readonly PlacedRouletteBet[]): PlacedRouletteBet[] {
  const map = new Map<string, PlacedRouletteBet>();
  for (const b of bets) {
    const key = betAreaKey(b.area);
    const prev = map.get(key);
    if (prev) {
      map.set(key, { area: b.area, chips: prev.chips + b.chips });
    } else {
      map.set(key, { ...b });
    }
  }
  return [...map.values()];
}

export const ROULETTE_SIMULATOR_CHIP_VALUES = [1, 5, 10, 25, 100] as const;
export type RouletteSimulatorChipValue = (typeof ROULETTE_SIMULATOR_CHIP_VALUES)[number];

export const ROULETTE_SIMULATOR_STARTING_BALANCE = 1000;
