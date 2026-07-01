/** Operador ice.bet — URLs e heurísticas do lobby «Jogar». */
const ICE_OPERATOR = {
  id: "ice-bet",
  hostPattern: /ice\.bet\.br/i,
  defaultMesaUrl:
    "https://ice.bet.br/games/tag/roulette/rouletteazure-pragmaticexternal",
  playButtonTexts: ["Jogar", "Play", "PLAY", "▶ Jogar", "▶ Play"],
  pragmaticHostPatterns: ["pragmaticplaylive\\.net", "client\\.pragmaticplaylive"],
  lobbyGateTimeoutMs: 28000,
  lobbyPollMs: 450,
  postNavigateSettleMs: 1200,
  initialDomWaitMs: 1500,
};

/** Mesa DGA → URL ice.bet (catálogo para ponte / popup). */
const ICE_MESA_CATALOG = {
  227: {
    label: "Roulette 1",
    url: "https://ice.bet.br/games/tag/roulette/rouletteazure-pragmaticexternal",
  },
  203: {
    label: "Speed Roulette 1",
    url: "https://ice.bet.br/games/tag/roulette/speedroulette-pragmaticexternal",
  },
  230: {
    label: "Roulette 3",
    url: "https://ice.bet.br/games/tag/roulette/roulette10ruby-pragmaticexternal",
  },
  201: {
    label: "Roulette 2 Extra Time",
    url: "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal",
  },
  206: {
    label: "Roulette Macao",
    url: "https://ice.bet.br/games/tag/roulette/roulettemacao-pragmaticexternal",
  },
  237: {
    label: "Roulette Brazilian",
    url: "https://ice.bet.br/games/tag/roulette/brazilianroulette-pragmaticexternal",
  },
  213: {
    label: "Korean Roulette",
    url: "https://ice.bet.br/games/tag/roulette/koreanroulette-pragmaticexternal",
  },
};

function isIceBetUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    return ICE_OPERATOR.hostPattern.test(new URL(url).hostname);
  } catch {
    return ICE_OPERATOR.hostPattern.test(url);
  }
}

function isIceCasinoGameUrl(url) {
  if (!isIceBetUrl(url)) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return path.includes("/games/");
  } catch {
    return /\/games\//i.test(url);
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.ICE_OPERATOR = ICE_OPERATOR;
  globalThis.ICE_MESA_CATALOG = ICE_MESA_CATALOG;
  globalThis.isIceBetUrl = isIceBetUrl;
  globalThis.isIceCasinoGameUrl = isIceCasinoGameUrl;
}
