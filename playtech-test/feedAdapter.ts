import type { RotatingUmFatorReplayInput } from "../src/lib/roulette/rotatingUmFatorSimHarness.ts";
import type { PlaytechLobbyFeed } from "./types.ts";

/** Converte export Playtech → entrada do motor Um Fator (sem IDs DGA). */
export function playtechFeedToReplayInput(feed: PlaytechLobbyFeed): RotatingUmFatorReplayInput {
  const tableIds = feed.tables.map((t) => t.id);
  return {
    tableIds,
    events: feed.events.map((e) => ({
      tableId: e.tableId,
      number: e.number,
      at: e.at,
    })),
  };
}

export function playtechTableLabelMap(feed: PlaytechLobbyFeed): Map<number, string> {
  return new Map(feed.tables.map((t) => [t.id, t.label]));
}
