/**
 * Posters oficiais Pragmatic DGA (`tableImage`) para roletas do lobby/sala rotativa.
 * Gerado com `npm run dga:fetch-roulette-images` (Jun 2026).
 */
export const DGA_ROULETTE_TABLE_POSTERS: Record<number, string> = {
  201: "https://client.pragmaticplaylive.net/desktop/assets/snaps/5kvxlw4c1qm3xcyn/poster.jpg",
  203: "https://client.pragmaticplaylive.net/desktop/assets/snaps/fl9knouu0yjez2wi/poster.jpg",
  205: "https://client.pragmaticplaylive.net/desktop/assets/snaps/r20speedrtwo201s/poster.jpg",
  206: "https://client.pragmaticplaylive.net/desktop/assets/snaps/yqpz3ichst2xg439/poster.jpg",
  213: "https://client.pragmaticplaylive.net/desktop/assets/snaps/381rwkr381korean/poster.jpg",
  221: "https://client.pragmaticplaylive.net/desktop/assets/snaps/t4jzencinod6iqwi/poster.jpg",
  224: "https://client.pragmaticplaylive.net/desktop/assets/snaps/p8l1j84prrmxzyic/poster.jpg",
  227: "https://client.pragmaticplaylive.net/desktop/assets/snaps/g03y1t9vvuhrfytl/poster.jpg",
  230: "https://client.pragmaticplaylive.net/desktop/assets/snaps/chroma229rwltr22/poster.jpg",
  233: "https://client.pragmaticplaylive.net/desktop/assets/snaps/romania233rwl291/poster.jpg",
  234: "https://client.pragmaticplaylive.net/desktop/assets/snaps/roulerw234rwl292/poster.jpg",
  237: "https://client.pragmaticplaylive.net/desktop/assets/snaps/rwbrzportrwa16rg/poster.jpg",
  28401: "https://client.pragmaticplaylive.net/desktop/assets/snaps/frenchroulette01/poster.jpg",
};

/** Cópias locais descarregadas da DGA (`public/lobby/dga/`). */
export function dgaRouletteLocalPosterPath(tableId: number): string {
  return `lobby/dga/${tableId}.jpg`;
}

export const DGA_ROULETTE_TABLE_IDS = Object.keys(DGA_ROULETTE_TABLE_POSTERS)
  .map((k) => parseInt(k, 10))
  .sort((a, b) => a - b);
