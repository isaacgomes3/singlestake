import assert from "node:assert/strict";

import { findFootballStudioEncounterCoincidences } from "../src/lib/evolution/footballStudioSidePatternByCard";
import type { TopCardRound } from "../src/lib/evolution/topCardEvoParser";
import { findFootballBlitzEncounterCoincidences } from "../src/lib/pragmatic/footballBlitzEcoStrategy";
import type { FootballBlitzRoundStored } from "../src/lib/pragmatic/dgaFootballBlitzHistory";

function studioRound(
  id: string,
  winner: "home" | "away" | "draw",
  home: string,
  away: string,
): TopCardRound {
  return {
    gameId: id,
    winner,
    home: {
      code: `${home}H`,
      rank: home,
      suit: "H",
      suitLabel: "H",
      score: home === "A" ? 14 : home === "K" ? 13 : Number(home) || 10,
      label: home,
    },
    away: {
      code: `${away}S`,
      rank: away,
      suit: "S",
      suitLabel: "S",
      score: away === "A" ? 14 : away === "K" ? 13 : Number(away) || 10,
      label: away,
    },
    source: "history",
  };
}

const studioHistory = [
  studioRound("now", "home", "K", "4"),
  studioRound("l1", "away", "7", "2"),
  studioRound("m1", "home", "K", "4"), // coincidence 1 — left=l1, right=r1
  studioRound("r1", "draw", "5", "5"),
  studioRound("x", "away", "9", "3"),
  studioRound("m2", "home", "K", "4"), // coincidence 2
  studioRound("r2", "home", "A", "2"),
];

const studio = findFootballStudioEncounterCoincidences(studioHistory, { limit: 2 });
assert.equal(studio.trigger?.pairLabel, "K/4");
assert.equal(studio.totalMatches, 2);
assert.equal(studio.coincidences.length, 2);
assert.equal(studio.coincidences[0]?.match.pairLabel, "K/4");
assert.equal(studio.coincidences[0]?.left?.pairLabel, "7/2");
assert.equal(studio.coincidences[0]?.right?.pairLabel, "5/5");
assert.equal(studio.coincidences[1]?.left?.pairLabel, "9/3");
assert.equal(studio.coincidences[1]?.right?.pairLabel, "A/2");

function blitzRound(
  id: string,
  winner: "home" | "away" | "draw",
  winNum: number,
  diff: number,
): FootballBlitzRoundStored {
  return {
    gameId: id,
    winner,
    winningNumber: winNum,
    scoreDiff: diff,
    time: new Date().toISOString(),
  };
}

// home K(13) vs 4 → win 13 diff 9
const blitzHistory = [
  blitzRound("now", "home", 13, 9),
  blitzRound("l1", "away", 10, 3),
  blitzRound("m1", "home", 13, 9),
  blitzRound("r1", "home", 8, 2),
  blitzRound("m2", "home", 13, 9),
];

const blitz = findFootballBlitzEncounterCoincidences(blitzHistory, { limit: 2 });
assert.equal(blitz.totalMatches, 2);
assert.equal(blitz.coincidences[0]?.match.pairLabel, "K/4");
assert.equal(blitz.coincidences[0]?.left?.pairLabel, "7/10");

console.log("ok — encounter coincidences studio + blitz");
