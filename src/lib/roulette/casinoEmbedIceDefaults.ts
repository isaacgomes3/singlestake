/**
 * URLs ice.bet.br por mesa DGA (sala rotativa + casino-mesa + extensão ice).
 * Activar na app com `VITE_CASINO_OPERATOR=ice` ou sobrescrever via `VITE_CASINO_TABLE_EMBED_URLS`.
 */
export const ICE_CASINO_TABLE_EMBED_URLS: Record<number, string> = {
  /** Roulette 1 */
  227: "https://ice.bet.br/games/tag/roulette/rouletteazure-pragmaticexternal",
  /** Speed Roulette 1 */
  203: "https://ice.bet.br/games/tag/roulette/speedroulette-pragmaticexternal",
  /** Roulette 3 */
  230: "https://ice.bet.br/games/tag/roulette/roulette10ruby-pragmaticexternal",
  /** Roulette 2 Extra Time */
  201: "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal",
  /** Roulette Macao */
  206: "https://ice.bet.br/games/tag/roulette/roulettemacao-pragmaticexternal",
  /** Roulette Brazilian */
  237: "https://ice.bet.br/games/tag/roulette/brazilianroulette-pragmaticexternal",
  /** Korean Roulette */
  213: "https://ice.bet.br/games/tag/roulette/koreanroulette-pragmaticexternal",
};

export const ICE_CASINO_DEFAULT_MESA_URL = ICE_CASINO_TABLE_EMBED_URLS[227];
