/**
 * Parser das mensagens WS Evolution Top Card / Football Studio.
 * Protocolo interno usa nomes Dragon Tiger:
 *   Dragon = Casa (Home)
 *   Tiger  = Visitante (Away)
 *
 * Exemplo cardDealt:
 *   {"type":"dragontiger.cardDealt","args":{"cards":{
 *     "Dragon":{"card":"AH","score":14},
 *     "Tiger":{"card":"4S","score":4}
 *   }}}
 *
 * Carta: rank + suit (A/2-9/T/J/Q/K + H/S/D/C)
 */

export type TopCardSuit = "H" | "S" | "D" | "C";
export type TopCardSide = "home" | "away" | "draw";

export type TopCardParsedCard = {
  code: string;
  rank: string;
  suit: TopCardSuit;
  suitLabel: string;
  score: number;
  label: string;
};

export type TopCardRound = {
  gameId: string;
  gameNumber?: string;
  winner: TopCardSide;
  home: TopCardParsedCard | null;
  away: TopCardParsedCard | null;
  homeScore?: number;
  awayScore?: number;
  source: "cardDealt" | "resolved" | "history";
  at?: number;
};

/** Escapes Unicode — evita corrupção de ♥♠♦♣ em alguns saves/encoding Windows. */
const SUIT_LABEL: Record<TopCardSuit, string> = {
  H: "\u2665",
  S: "\u2660",
  D: "\u2666",
  C: "\u2663",
};

export function suitLabelFor(suit: TopCardSuit | string | null | undefined): string {
  const key = String(suit ?? "").trim().toUpperCase();
  if (key === "H" || key === "S" || key === "D" || key === "C") return SUIT_LABEL[key];
  return "";
}

/** Reconstrói label legível a partir de rank/suit/code (ignora label corrompido). */
export function formatTopCardLabel(card: {
  label?: string | null;
  rank?: string | null;
  suit?: string | null;
  code?: string | null;
} | null | undefined): string {
  if (!card) return "";
  const suit = String(card.suit ?? "").trim().toUpperCase();
  let rank = String(card.rank ?? "").trim().toUpperCase();
  if (!rank && card.code) {
    const code = String(card.code).trim().toUpperCase();
    rank = code.slice(0, -1);
    if (rank === "T") rank = "10";
  }
  if (!rank && card.label) {
    const m = String(card.label).match(/^(10|[2-9AJQK])/i);
    rank = m ? m[1]!.toUpperCase() : "";
    if (rank === "T") rank = "10";
  }
  const suitGlyph = suitLabelFor(suit);
  if (rank && suitGlyph) return `${rank}${suitGlyph}`;
  const label = String(card.label ?? "").trim();
  // Descarta labels só com control chars / lixo.
  if (label && /[2-9AJQK]|10/i.test(label)) {
    const cleaned = label.replace(/[\u0000-\u001f]/g, "");
    if (cleaned.length >= 2) return cleaned;
  }
  return rank || String(card.code ?? "").trim() || "";
}

const RANK_FROM_SCORE: Record<number, string> = {
  14: "A",
  13: "K",
  12: "Q",
  11: "J",
  10: "10",
  9: "9",
  8: "8",
  7: "7",
  6: "6",
  5: "5",
  4: "4",
  3: "3",
  2: "2",
};

export function mapDragonTigerWinner(raw: unknown): TopCardSide | null {
  const value = String(raw ?? "").toLowerCase();
  if (value === "dragon" || value === "home" || value === "player") return "home";
  if (value === "tiger" || value === "away" || value === "banker") return "away";
  if (value === "tie" || value === "draw" || value === "empate") return "draw";
  return null;
}

export function parseTopCardCode(
  code: unknown,
  score?: unknown,
): TopCardParsedCard | null {
  const raw = String(code ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  const suit = raw.slice(-1) as TopCardSuit;
  if (!"HSDC".includes(suit)) return null;
  let rank = raw.slice(0, -1);
  if (rank === "T") rank = "10";
  const numericScore = Number(score);
  if (!rank && Number.isFinite(numericScore)) {
    rank = RANK_FROM_SCORE[numericScore] ?? String(numericScore);
  }
  if (!rank) return null;
  return {
    code: raw,
    rank,
    suit,
    suitLabel: SUIT_LABEL[suit],
    score: Number.isFinite(numericScore) ? numericScore : 0,
    label: `${rank}${SUIT_LABEL[suit]}`,
  };
}

function parseJsonMessage(text: string): { type?: string; args?: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(text) as { type?: string; args?: Record<string, unknown> };
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Extrai rodada completa a partir de cardDealt (com as duas cartas) ou resolved.
 */
export function parseTopCardEvoMessage(text: string): TopCardRound | null {
  const msg = parseJsonMessage(text);
  if (!msg?.type || !msg.args) return null;

  if (msg.type === "dragontiger.cardDealt") {
    const cards = msg.args.cards as
      | {
          Dragon?: { card?: string; score?: number };
          Tiger?: { card?: string; score?: number };
        }
      | undefined;
    if (!cards?.Dragon?.card || !cards?.Tiger?.card) return null;
    const home = parseTopCardCode(cards.Dragon.card, cards.Dragon.score);
    const away = parseTopCardCode(cards.Tiger.card, cards.Tiger.score);
    if (!home || !away) return null;
    let winner: TopCardSide = "draw";
    if (home.score > away.score) winner = "home";
    else if (away.score > home.score) winner = "away";
    return {
      gameId: String(msg.args.gameId ?? ""),
      gameNumber: typeof msg.args.gameNumber === "string" ? msg.args.gameNumber : undefined,
      winner,
      home,
      away,
      homeScore: home.score,
      awayScore: away.score,
      source: "cardDealt",
    };
  }

  if (msg.type === "dragontiger.resolved") {
    const result = msg.args.result as
      | { winner?: string; dragonScore?: number; tigerScore?: number }
      | undefined;
    if (!result) return null;
    const winner = mapDragonTigerWinner(result.winner);
    if (!winner) return null;
    return {
      gameId: String(msg.args.gameId ?? ""),
      gameNumber: typeof msg.args.gameNumber === "string" ? msg.args.gameNumber : undefined,
      winner,
      home: null,
      away: null,
      homeScore: Number(result.dragonScore) || undefined,
      awayScore: Number(result.tigerScore) || undefined,
      source: "resolved",
    };
  }

  return null;
}

export function topCardSideLabel(side: TopCardSide): string {
  if (side === "home") return "Casa";
  if (side === "away") return "Visitante";
  return "Empate";
}
