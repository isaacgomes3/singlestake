/**
 * Smoke test — padrão de lado por carta Football Studio.
 */
import assert from "node:assert/strict";

import {
  analyzeFootballStudioSidePatternByCard,
  findFootballStudioSidePatternAlert,
} from "../src/lib/evolution/footballStudioSidePatternByCard";
import type { TopCardParsedCard, TopCardRound } from "../src/lib/evolution/topCardEvoParser";

function card(rank: string, score: number): TopCardParsedCard {
  return {
    code: `${rank}H`,
    rank,
    suit: "H",
    suitLabel: "♥",
    score,
    label: `${rank}♥`,
  };
}

function round(
  id: string,
  winner: "home" | "away",
  homeRank: string,
  awayRank: string,
): TopCardRound {
  const homeScore = homeRank === "A" ? 14 : Number(homeRank) || 10;
  const awayScore = awayRank === "A" ? 14 : Number(awayRank) || 10;
  return {
    gameId: id,
    winner,
    home: card(homeRank, homeScore),
    away: card(awayRank, awayScore),
    homeScore,
    awayScore,
    source: "history",
  };
}

const maintainHistory = [
  round("trig", "home", "9", "6"),
  round("h", "away", "7", "5"),
  round("g", "away", "9", "5"),
  round("f", "home", "7", "5"),
  round("e", "home", "6", "2"),
  round("d", "away", "8", "5"),
  round("c", "away", "9", "8"),
  round("b", "home", "5", "4"),
  round("a", "home", "6", "2"),
];

const analysis = analyzeFootballStudioSidePatternByCard(maintainHistory, {
  top: 6,
  minSamples: 1,
});
assert.ok(analysis.transitions >= 2);

const alert = findFootballStudioSidePatternAlert(maintainHistory, { minSamples: 2 });
assert.ok(alert);
assert.equal(alert!.mode, "maintain");
assert.equal(alert!.indication, "home");
assert.equal(alert!.homeLabel, "9");
assert.equal(alert!.awayLabel, "6");

console.log("ok — Football Studio side pattern by card");
