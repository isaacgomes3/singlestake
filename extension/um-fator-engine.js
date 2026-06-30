"use strict";
var SinglestakeUmFator = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // extension/strategy-entry.ts
  var strategy_entry_exports = {};
  __export(strategy_entry_exports, {
    EXTENSION_MAX_GALES: () => EXTENSION_MAX_GALES,
    EXTENSION_PRE_BET_WAIT_SEC: () => EXTENSION_PRE_BET_WAIT_SEC,
    ROTATING_ROOM_TABLE_IDS: () => ROTATING_ROOM_TABLE_IDS,
    clampExtensionMaxRecovery: () => clampExtensionMaxRecovery,
    createRotativaEngine: () => createRotativaEngine,
    createUmFatorEngine: () => createUmFatorEngine,
    default: () => strategy_entry_default
  });

  // src/lib/roulette/entryWinBreakdown.ts
  function emptyRecoveryLevelCounts(maxRecovery) {
    return Array.from({ length: maxRecovery + 1 }, () => 0);
  }
  function emptyUmFatorMatchTierStats() {
    return {
      twoEqualFactors: { wins: 0, losses: 0 },
      threeEqualFactors: { wins: 0, losses: 0 }
    };
  }
  function parseUmFatorMatchTierBucket(raw) {
    const o = raw ?? {};
    return {
      wins: Math.max(0, Number(o.wins) || 0),
      losses: Math.max(0, Number(o.losses) || 0)
    };
  }
  function parseUmFatorMatchTierStats(raw) {
    const o = raw ?? {};
    return {
      twoEqualFactors: parseUmFatorMatchTierBucket(o.twoEqualFactors),
      threeEqualFactors: parseUmFatorMatchTierBucket(o.threeEqualFactors)
    };
  }
  function normalizeUmFatorMatchTierStats(stats) {
    if (!stats) return emptyUmFatorMatchTierStats();
    return parseUmFatorMatchTierStats(stats);
  }
  function parseRecoveryLevelCounts(raw, maxRecovery) {
    const base = emptyRecoveryLevelCounts(maxRecovery);
    if (!Array.isArray(raw)) return base;
    for (let i = 0; i <= maxRecovery; i++) {
      const n = Number(raw[i]);
      if (Number.isFinite(n) && n >= 0) base[i] = n;
    }
    return base;
  }
  function parseRotatingRoomSessionStats(raw, maxRecovery = 5) {
    const o = raw ?? {};
    const base = {
      wins: Number(o.wins) || 0,
      losses: Number(o.losses) || 0,
      winsAtRecovery: parseRecoveryLevelCounts(o.winsAtRecovery, maxRecovery),
      lossesAtRecovery: parseRecoveryLevelCounts(o.lossesAtRecovery, maxRecovery)
    };
    if (o.umFatorMatchTier != null) {
      return { ...base, umFatorMatchTier: parseUmFatorMatchTierStats(o.umFatorMatchTier) };
    }
    return base;
  }
  function emptyRotatingRoomSessionStats(maxRecovery = 5) {
    return {
      wins: 0,
      losses: 0,
      winsAtRecovery: emptyRecoveryLevelCounts(maxRecovery),
      lossesAtRecovery: emptyRecoveryLevelCounts(maxRecovery)
    };
  }
  function normalizeRecoveryLevelCounts(counts, maxRecovery) {
    return parseRecoveryLevelCounts(counts, maxRecovery);
  }
  function recoveryIndex(recoveryAtEvent, maxRecovery) {
    return Math.min(Math.max(0, recoveryAtEvent), maxRecovery);
  }
  function recordRotatingRoomSessionWin(stats, recoveryAtWin, maxRecovery) {
    const idx = recoveryIndex(recoveryAtWin, maxRecovery);
    const winsAtRecovery = normalizeRecoveryLevelCounts(stats.winsAtRecovery, maxRecovery);
    winsAtRecovery[idx] += 1;
    return { ...stats, wins: stats.wins + 1, winsAtRecovery };
  }
  function recordRotatingRoomSessionPartialLoss(stats, recoveryAtLoss, maxRecovery) {
    const idx = recoveryIndex(recoveryAtLoss, maxRecovery);
    const lossesAtRecovery = normalizeRecoveryLevelCounts(stats.lossesAtRecovery, maxRecovery);
    lossesAtRecovery[idx] += 1;
    return { ...stats, lossesAtRecovery };
  }
  function recordRotatingRoomSessionFinalLoss(stats, recoveryAtLoss, maxRecovery) {
    const withPartial = recordRotatingRoomSessionPartialLoss(stats, recoveryAtLoss, maxRecovery);
    return { ...withPartial, losses: withPartial.losses + 1 };
  }
  function recordUmFatorMatchTierWin(stats, tier) {
    const umFatorMatchTier = normalizeUmFatorMatchTierStats(stats.umFatorMatchTier);
    const key = tier === "two" ? "twoEqualFactors" : "threeEqualFactors";
    return {
      ...stats,
      umFatorMatchTier: {
        ...umFatorMatchTier,
        [key]: {
          wins: umFatorMatchTier[key].wins + 1,
          losses: umFatorMatchTier[key].losses
        }
      }
    };
  }
  function recordUmFatorMatchTierLoss(stats, tier) {
    const umFatorMatchTier = normalizeUmFatorMatchTierStats(stats.umFatorMatchTier);
    const key = tier === "two" ? "twoEqualFactors" : "threeEqualFactors";
    return {
      ...stats,
      umFatorMatchTier: {
        ...umFatorMatchTier,
        [key]: {
          wins: umFatorMatchTier[key].wins,
          losses: umFatorMatchTier[key].losses + 1
        }
      }
    };
  }

  // src/lib/roulette/lobbyTables.ts
  var import_meta = {};
  function readRouletteMacaoTableIdFromEnv() {
    const viteRaw = typeof import_meta !== "undefined" && typeof import_meta.env?.VITE_ROULETTE_MACAO_TABLE_ID === "string" ? import_meta.env.VITE_ROULETTE_MACAO_TABLE_ID.trim() : "";
    if (viteRaw) {
      const n = parseInt(viteRaw, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const nodeRaw = typeof process !== "undefined" && typeof process.env?.ROULETTE_MACAO_TABLE_ID === "string" ? process.env.ROULETTE_MACAO_TABLE_ID.trim() : "";
    if (nodeRaw) {
      const n = parseInt(nodeRaw, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 206;
  }
  var ROULETTE_MACAO_TABLE_ID = readRouletteMacaoTableIdFromEnv();
  var LEGACY_LOBBY_ROULETTE_TABLE_IDS = [234, 227];
  var LOBBY_EXTRA_ROULETTE_TABLE_IDS = [203, 230, 205, 201];
  var LOBBY_REGIONAL_ROULETTE_TABLE_IDS = [224, 221, 233, 213, 237];
  var ROTATING_ROOM_PREMIUM_TABLE_IDS = [28401];
  var LEGACY_LOBBY_ID_SET = new Set(LEGACY_LOBBY_ROULETTE_TABLE_IDS);
  var LOBBY_EXTRA_ID_SET = new Set(LOBBY_EXTRA_ROULETTE_TABLE_IDS);
  var LOBBY_REGIONAL_ID_SET = new Set(LOBBY_REGIONAL_ROULETTE_TABLE_IDS);
  var ROTATING_ROOM_PREMIUM_ID_SET = new Set(ROTATING_ROOM_PREMIUM_TABLE_IDS);
  function buildLobbyFixedTableIds(macaoTableId = ROULETTE_MACAO_TABLE_ID) {
    const extras = LOBBY_EXTRA_ROULETTE_TABLE_IDS.filter((id) => id !== macaoTableId);
    const regionals = LOBBY_REGIONAL_ROULETTE_TABLE_IDS.filter((id) => id !== macaoTableId);
    return [...LEGACY_LOBBY_ROULETTE_TABLE_IDS, macaoTableId, ...extras, ...regionals];
  }
  var LOBBY_FIXED_TABLE_IDS = buildLobbyFixedTableIds();
  function buildRotatingRoomTableIds(macaoTableId = ROULETTE_MACAO_TABLE_ID) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const id of [227, 203, 230, 201, macaoTableId, 237, 213]) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }
  var ROTATING_ROOM_FIXED_TABLE_IDS = buildRotatingRoomTableIds();
  function buildMobileRouletteTableIds(macaoTableId = ROULETTE_MACAO_TABLE_ID) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const id of [234, ...buildRotatingRoomTableIds(macaoTableId)]) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }
  var MOBILE_ROULETTE_FIXED_TABLE_IDS = buildMobileRouletteTableIds();
  var LOBBY_TABLE_DISPLAY_NAMES = {
    234: "Roulette Latina",
    227: "Roulette 1",
    [ROULETTE_MACAO_TABLE_ID]: "Roulette Macao",
    203: "Speed Roulette 1",
    230: "Roulette 3",
    205: "Speed Roulette 2",
    201: "Roulette 2 Extra Time",
    224: "Roleta Turca",
    221: "Roleta Russa",
    233: "Roleta Romena",
    213: "Korean Roulette",
    237: "Brasileira Roleta"
  };

  // src/lib/roulette/streetPairTrigger.ts
  var RED = /* @__PURE__ */ new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  function colorOf(n) {
    if (n === 0) return "Zero";
    return RED.has(n) ? "Vermelho" : "Preto";
  }
  function heightOf(n) {
    if (n === 0) return "Zero";
    return n <= 18 ? "Baixo" : "Alto";
  }
  function parityOf(n) {
    if (n === 0) return "Zero";
    return n % 2 === 0 ? "Par" : "Impar";
  }

  // src/lib/roulette/doisFatoresStrategy.ts
  var DOIS_FATORES_REFERENCE_INDEX = 4;
  var POST_DEFEAT_REARM_SPIN_COUNT = DOIS_FATORES_REFERENCE_INDEX + 1;
  function factorDisplayLabel(f) {
    switch (f.kind) {
      case "cor":
        return f.value === "Vermelho" ? "Vermelho" : "Preto";
      case "paridade":
        return f.value === "Par" ? "Par" : "\xCDmpar";
      case "altura":
        return f.value === "Baixo" ? "Baixo 1\u201318" : "Alto 19\u201336";
    }
  }
  function doisFatoresFactorLabel(f) {
    return factorDisplayLabel(f);
  }
  function factorWins(num, factor) {
    switch (factor.kind) {
      case "cor":
        return colorOf(num) === factor.value;
      case "paridade":
        return parityOf(num) === factor.value;
      case "altura":
        return heightOf(num) === factor.value;
    }
  }
  function evaluateDoisFatoresRound(num, active) {
    if (num === 0) return "L";
    const f1Win = factorWins(num, active.factor1);
    const f2Win = factorWins(num, active.factor2);
    const f1Lose = !f1Win;
    const f2Lose = !f2Win;
    if (f1Win && f2Win) return "W";
    if (f1Lose && f2Lose) return "L";
    return "continue";
  }
  function doisFatoresExteriorCellKey(factor) {
    switch (factor.kind) {
      case "cor":
        return factor.value === "Vermelho" ? "red" : "black";
      case "paridade":
        return factor.value === "Par" ? "even" : "odd";
      case "altura":
        return factor.value === "Baixo" ? "low" : "high";
    }
  }

  // src/lib/roulette/pragmaticExteriorBetMap.ts
  function pragmaticExteriorBetKeyFromFactor(factor) {
    return doisFatoresExteriorCellKey(factor);
  }

  // src/lib/roulette/liveTableColdStats.ts
  function numbers1to36Where(pred) {
    const r = [];
    for (let n = 1; n <= 36; n++) {
      if (pred(n)) r.push(n);
    }
    return r;
  }
  var CROSSING_BUCKET_DEFINITIONS = Object.freeze([
    {
      axis: "cor-altura",
      category: "Vermelho \xB7 Baixo (1\u201318)",
      nums: numbers1to36Where((n) => colorOf(n) === "Vermelho" && heightOf(n) === "Baixo")
    },
    {
      axis: "cor-altura",
      category: "Vermelho \xB7 Alto (19\u201336)",
      nums: numbers1to36Where((n) => colorOf(n) === "Vermelho" && heightOf(n) === "Alto")
    },
    {
      axis: "cor-altura",
      category: "Preto \xB7 Baixo (1\u201318)",
      nums: numbers1to36Where((n) => colorOf(n) === "Preto" && heightOf(n) === "Baixo")
    },
    {
      axis: "cor-altura",
      category: "Preto \xB7 Alto (19\u201336)",
      nums: numbers1to36Where((n) => colorOf(n) === "Preto" && heightOf(n) === "Alto")
    },
    {
      axis: "cor-paridade",
      category: "Vermelho \xB7 Par",
      nums: numbers1to36Where((n) => colorOf(n) === "Vermelho" && parityOf(n) === "Par")
    },
    {
      axis: "cor-paridade",
      category: "Vermelho \xB7 \xCDmpar",
      nums: numbers1to36Where((n) => colorOf(n) === "Vermelho" && parityOf(n) === "Impar")
    },
    {
      axis: "cor-paridade",
      category: "Preto \xB7 Par",
      nums: numbers1to36Where((n) => colorOf(n) === "Preto" && parityOf(n) === "Par")
    },
    {
      axis: "cor-paridade",
      category: "Preto \xB7 \xCDmpar",
      nums: numbers1to36Where((n) => colorOf(n) === "Preto" && parityOf(n) === "Impar")
    },
    {
      axis: "altura-paridade",
      category: "Baixo (1\u201318) \xB7 Par",
      nums: numbers1to36Where((n) => heightOf(n) === "Baixo" && parityOf(n) === "Par")
    },
    {
      axis: "altura-paridade",
      category: "Baixo (1\u201318) \xB7 \xCDmpar",
      nums: numbers1to36Where((n) => heightOf(n) === "Baixo" && parityOf(n) === "Impar")
    },
    {
      axis: "altura-paridade",
      category: "Alto (19\u201336) \xB7 Par",
      nums: numbers1to36Where((n) => heightOf(n) === "Alto" && parityOf(n) === "Par")
    },
    {
      axis: "altura-paridade",
      category: "Alto (19\u201336) \xB7 \xCDmpar",
      nums: numbers1to36Where((n) => heightOf(n) === "Alto" && parityOf(n) === "Impar")
    }
  ]);

  // src/lib/roulette/doisFatoresPatternCrossing.ts
  var ROTATING_ROOM_CROSSING_ZERO_EXCLUDE_SPINS = 12;
  var ROTATING_ROOM_CROSSING_PATTERN_AXES = [
    "cor-altura",
    "altura-paridade",
    "cor-paridade"
  ];
  var CROSSING_PATTERN_PRIORITY = {
    primary: 3,
    secondary: 2,
    tertiary: 1
  };
  var AXIS_ORDER = ROTATING_ROOM_CROSSING_PATTERN_AXES;
  function tableHasZeroInLastSpins(historyNewestFirst, window2 = ROTATING_ROOM_CROSSING_ZERO_EXCLUDE_SPINS) {
    for (let i = 0; i < Math.min(window2, historyNewestFirst.length); i++) {
      if (historyNewestFirst[i] === 0) return true;
    }
    return false;
  }
  function factorsForNumberOnAxis(n, axis) {
    if (n === 0) return null;
    const col = colorOf(n);
    const alt = heightOf(n);
    const par = parityOf(n);
    if (axis === "cor-altura") {
      if (col === "Zero" || alt === "Zero") return null;
      return [{ kind: "cor", value: col }, { kind: "altura", value: alt }];
    }
    if (axis === "cor-paridade") {
      if (col === "Zero" || par === "Zero") return null;
      return [{ kind: "cor", value: col }, { kind: "paridade", value: par }];
    }
    if (axis === "altura-paridade") {
      if (alt === "Zero" || par === "Zero") return null;
      return [{ kind: "altura", value: alt }, { kind: "paridade", value: par }];
    }
    return null;
  }
  function crossingCategoryForNumber(n, axis) {
    if (n === 0) return null;
    const def = CROSSING_BUCKET_DEFINITIONS.find((d) => d.axis === axis && d.nums.includes(n));
    return def?.category ?? null;
  }
  function sigAt(historyNewestFirst, index, axis) {
    const n = historyNewestFirst[index];
    if (n === void 0) return null;
    return crossingCategoryForNumber(n, axis);
  }
  function buildMatch(axis, patternKind, category, historyNewestFirst, triggerIndices) {
    const refIndex = triggerIndices[0];
    if (refIndex === void 0) return null;
    const refNum = historyNewestFirst[refIndex];
    if (refNum === void 0) return null;
    const factors = factorsForNumberOnAxis(refNum, axis);
    if (!factors) return null;
    const triggerNumbers = triggerIndices.map((i) => historyNewestFirst[i]).filter((n) => n !== void 0);
    return {
      axis,
      patternKind,
      category,
      factor1: factors[0],
      factor2: factors[1],
      triggerNumbers,
      patternPriority: CROSSING_PATTERN_PRIORITY[patternKind]
    };
  }
  function matchPrimaryOnAxis(historyNewestFirst, axis) {
    if (historyNewestFirst.length < 3) return null;
    const s0 = sigAt(historyNewestFirst, 0, axis);
    const s1 = sigAt(historyNewestFirst, 1, axis);
    const s2 = sigAt(historyNewestFirst, 2, axis);
    if (!s0 || !s1 || !s2) return null;
    if (s0 !== s1 || s1 !== s2) return null;
    return buildMatch(axis, "primary", s0, historyNewestFirst, [0, 1, 2]);
  }
  function matchSecondaryOnAxis(historyNewestFirst, axis) {
    if (historyNewestFirst.length < 4) return null;
    const s = [0, 1, 2, 3].map((i) => sigAt(historyNewestFirst, i, axis));
    if (s.some((x) => !x)) return null;
    const [a, b, c, d] = s;
    if (a === b && a === d && c !== a) {
      return buildMatch(axis, "secondary", a, historyNewestFirst, [0, 1, 2, 3]);
    }
    return null;
  }
  function matchTertiaryOnAxis(historyNewestFirst, axis) {
    if (historyNewestFirst.length < 4) return null;
    const s = [0, 1, 2, 3].map((i) => sigAt(historyNewestFirst, i, axis));
    if (s.some((x) => !x)) return null;
    const [a, b, c, d] = s;
    if (a === c && a === d && b !== a) {
      return buildMatch(axis, "tertiary", a, historyNewestFirst, [0, 1, 2, 3]);
    }
    return null;
  }
  function matchOnAxisByKind(historyNewestFirst, axis, patternKind) {
    switch (patternKind) {
      case "primary":
        return matchPrimaryOnAxis(historyNewestFirst, axis);
      case "secondary":
        return matchSecondaryOnAxis(historyNewestFirst, axis);
      case "tertiary":
        return matchTertiaryOnAxis(historyNewestFirst, axis);
    }
  }
  function findPriorPatternAxis(historyNewestFirst) {
    if (historyNewestFirst.length < 4) return null;
    const tail = historyNewestFirst.slice(1);
    for (const kind of ["primary", "secondary", "tertiary"]) {
      for (const axis of AXIS_ORDER) {
        if (matchOnAxisByKind(tail, axis, kind)) return axis;
      }
    }
    return null;
  }
  function resolveAxisPreference(historyNewestFirst, candidates) {
    if (candidates.length === 1) return candidates[0];
    const priorAxis = findPriorPatternAxis(historyNewestFirst);
    if (priorAxis) {
      const preferred = candidates.find((c) => c.axis === priorAxis);
      if (preferred) return preferred;
    }
    const sorted = [...candidates].sort(
      (a, b) => AXIS_ORDER.indexOf(a.axis) - AXIS_ORDER.indexOf(b.axis)
    );
    return sorted[0];
  }
  function detectPatternOnTableByKind(historyNewestFirst, patternKind) {
    const candidates = [];
    for (const axis of AXIS_ORDER) {
      const m = matchOnAxisByKind(historyNewestFirst, axis, patternKind);
      if (m) candidates.push(m);
    }
    if (candidates.length === 0) return null;
    return resolveAxisPreference(historyNewestFirst, candidates);
  }
  function detectBestPatternOnTable(historyNewestFirst) {
    if (tableHasZeroInLastSpins(historyNewestFirst)) return null;
    for (const kind of ["primary", "secondary", "tertiary"]) {
      const m = detectPatternOnTableByKind(historyNewestFirst, kind);
      if (m) return m;
    }
    return null;
  }
  function crossingPatternKindLabel(kind) {
    switch (kind) {
      case "primary":
        return "Prim\xE1rio x-x-x";
      case "secondary":
        return "Secund\xE1rio x-x-y-x";
      case "tertiary":
        return "Terci\xE1rio x-y-x-x";
    }
  }

  // src/lib/roulette/umFatorTriggerEnable.ts
  var DEFAULT_UM_FATOR_TRIGGER_ENABLE = {
    two: false,
    three: false
  };
  var DEFAULT_ROTATING_ROOM_GATILHO_ENABLE = {
    ...DEFAULT_UM_FATOR_TRIGGER_ENABLE,
    crossing: true
  };
  var runtimeEnabled = { ...DEFAULT_ROTATING_ROOM_GATILHO_ENABLE };
  function isUmFatorTriggerTierEnabled(tier) {
    return runtimeEnabled[tier] !== false;
  }
  function isCrossingGatilhoEnabled() {
    return runtimeEnabled.crossing !== false;
  }

  // src/lib/roulette/historyStorage.ts
  function parseSpinTimesJson(raw) {
    if (raw == null) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const out = [];
      for (const x of parsed) {
        if (x === null) {
          out.push(null);
          continue;
        }
        if (typeof x === "number" && Number.isFinite(x)) out.push(x);
        else out.push(null);
      }
      return out;
    } catch {
      return [];
    }
  }
  function liveTableSpinTimesStorageKey(tableId) {
    return `roulette.liveTableSpinTimes.${tableId}`;
  }
  function readLiveTableSpinTimesAligned(tableId, historyLength) {
    if (typeof window === "undefined" || historyLength <= 0) return [];
    try {
      const raw = parseSpinTimesJson(window.localStorage.getItem(liveTableSpinTimesStorageKey(tableId)));
      if (raw.length >= historyLength) return raw.slice(0, historyLength);
      return [...raw, ...Array.from({ length: historyLength - raw.length }, () => null)];
    } catch {
      return Array.from({ length: historyLength }, () => null);
    }
  }

  // src/lib/roulette/liveTableBettingWindow.ts
  var LIVE_TABLE_BETTING_WINDOW_SEC = 20;
  var ROTATING_ROOM_MIN_BETTING_TIME_REMAINING_SEC = 11;
  var EXTENSION_PRE_BET_WAIT_SEC = 11;
  function liveTableBettingRemainingSec(tableId, historyNewestFirst, nowMs = Date.now(), bettingWindowSec = LIVE_TABLE_BETTING_WINDOW_SEC) {
    if (historyNewestFirst.length === 0) return 0;
    const times = readLiveTableSpinTimesAligned(tableId, historyNewestFirst.length);
    const t0 = times[0] ?? null;
    if (t0 == null) return bettingWindowSec;
    const elapsedSec = Math.max(0, (nowMs - t0) / 1e3);
    return Math.max(0, bettingWindowSec - elapsedSec);
  }
  function tableAcceptableForRotatingRoomEntry(tableId, historyNewestFirst, minRemainingSec = ROTATING_ROOM_MIN_BETTING_TIME_REMAINING_SEC, nowMs) {
    return liveTableBettingRemainingSec(tableId, historyNewestFirst, nowMs) >= minRemainingSec;
  }
  function tableArmableForUmFatorFormation(tableId, historyNewestFirst, nowMs) {
    return tableAcceptableForRotatingRoomEntry(tableId, historyNewestFirst, nowMs);
  }

  // src/lib/roulette/rotatingRoomCrossingStrategy.ts
  function spinHeadFromHistory(history) {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }
  var ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS = 1;
  var ROTATING_ROOM_CROSSING_MAX_RECOVERY = 5;
  function pickFromPatternMatch(tableId, match) {
    const t0 = match.triggerNumbers[0] ?? 0;
    const t1 = match.triggerNumbers[1] ?? t0;
    return {
      tableId,
      axis: match.axis,
      category: match.category,
      absentCategory: match.category,
      bucketGap: match.patternPriority,
      absenceGap: match.patternPriority,
      excludedPair: [t0, t1],
      patternKind: match.patternKind,
      triggerNumbers: match.triggerNumbers,
      factor1: match.factor1,
      factor2: match.factor2
    };
  }
  function pairKindFromAxis(axis) {
    return axis;
  }
  function pairKindLabel(axis) {
    switch (axis) {
      case "cor-altura":
        return "Cor \xB7 Altura";
      case "cor-paridade":
        return "Cor \xB7 Paridade";
      case "altura-paridade":
        return "Paridade \xB7 Altura";
    }
  }
  function crossingAxisFromActive(active) {
    return active.pairKind;
  }
  function crossingFingerprint(tableId, axis, category) {
    return `${tableId}:${axis}:${category}`;
  }
  function buildCrossingActiveFromPick(pick) {
    return {
      pairKind: pairKindFromAxis(pick.axis),
      pairKindLabel: pairKindLabel(pick.axis),
      patternMode: "convergence",
      patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
      referenceNumber: pick.triggerNumbers[0] ?? pick.excludedPair[0],
      factor1: pick.factor1,
      factor2: pick.factor2,
      triggerNumbers: [pick.excludedPair[0], pick.excludedPair[1]],
      armingDescription: `${crossingPatternKindLabel(pick.patternKind)} \xB7 ${pick.category} (mesa ${pick.tableId})`
    };
  }
  function pickForTableByCategory(tableId, historyNewestFirst, axis, category) {
    const match = detectBestPatternOnTable(historyNewestFirst);
    if (!match || match.axis !== axis || match.category !== category) return null;
    return pickFromPatternMatch(tableId, match);
  }
  function crossingFlashSnapshot(active, history, tableId, machine) {
    const triggerNumbers = history.slice(0, 4);
    if (!active) return { triggerNumbers };
    const axis = crossingAxisFromActive(active);
    const category = machine.cycleMetricCategory;
    const live = category ? pickForTableByCategory(tableId, history, axis, category) : null;
    return {
      factor1: active.factor1,
      factor2: active.factor2,
      triggerNumbers,
      bucketGap: live?.bucketGap ?? 0
    };
  }
  function clearPrepareState(machine) {
    return {
      ...machine,
      prepareFingerprint: null,
      prepareTableId: null,
      prepareActive: null,
      pendingQueueEntry: null,
      armedAtHead: null,
      prepareSpinsWithoutPattern: 0
    };
  }
  function bestPickForTable(tableId, historyNewestFirst, _minAbsenceSpins = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS) {
    const match = detectBestPatternOnTable(historyNewestFirst);
    if (!match) return null;
    return pickFromPatternMatch(tableId, match);
  }
  function pickForTableOnAxis(tableId, historyNewestFirst, axis, _minGap = 1, category) {
    const match = detectBestPatternOnTable(historyNewestFirst);
    if (!match || match.axis !== axis) return null;
    if (category && match.category !== category) return null;
    return pickFromPatternMatch(tableId, match);
  }
  function comparePicks(a, b) {
    if (a.absenceGap !== b.absenceGap) return b.absenceGap - a.absenceGap;
    return a.tableId - b.tableId;
  }
  function listAllAlertPicks(tableIds, histories, excludeTableIds, _minAbsenceSpins = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS) {
    const kinds = ["primary", "secondary", "tertiary"];
    for (const kind of kinds) {
      const out = [];
      for (const tableId of tableIds) {
        if (excludeTableIds?.has(tableId)) continue;
        const history = histories[tableId] ?? [];
        if (!tableAcceptableForRotatingRoomEntry(tableId, history)) continue;
        if (tableHasZeroInLastSpins(history)) continue;
        const match = detectPatternOnTableByKind(history, kind);
        if (match) out.push(pickFromPatternMatch(tableId, match));
      }
      if (out.length > 0) {
        out.sort(comparePicks);
        return out;
      }
    }
    return [];
  }
  function pickGlobalCrossingAlert(tableIds, histories, excludeTableIds, minAbsenceSpins = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS) {
    if (!isCrossingGatilhoEnabled()) return null;
    return listAllAlertPicks(tableIds, histories, excludeTableIds, minAbsenceSpins)[0] ?? null;
  }
  function pickGlobalCrossingAlertWithFallback(tableIds, histories, excludeTableIds, minAbsenceSpins = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS) {
    return pickGlobalCrossingAlert(tableIds, histories, excludeTableIds, minAbsenceSpins);
  }
  function armCycleFromPick(machine, pick, histories, recovery) {
    const active = buildCrossingActiveFromPick(pick);
    if (!active) return machine;
    return armCycleFromActive(machine, pick, active, histories, recovery);
  }
  function armCycleFromActive(machine, pick, active, histories, recovery, opts) {
    const head = spinHeadFromHistory(histories[pick.tableId] ?? []);
    return {
      ...machine,
      cycleTableId: pick.tableId,
      cycleFingerprint: crossingFingerprint(pick.tableId, pick.axis, pick.category),
      cycleActive: active,
      recovery,
      cycleSpinsWithoutWin: 0,
      armedAtHead: head,
      lastEvaluatedHead: opts?.lastEvaluatedHead ?? null,
      signalQueue: [],
      awaitingQueueTableId: null,
      awaitingQueueHead: null,
      awaitSwitchNoTable: false,
      prepareFingerprint: null,
      prepareTableId: null,
      prepareActive: null,
      pendingQueueEntry: null,
      cycleMetricCategory: pick.absentCategory
    };
  }
  function clearCycle(machine) {
    return {
      ...machine,
      cycleTableId: null,
      cycleFingerprint: null,
      cycleActive: null,
      cycleMetricCategory: null,
      cycleSpinsWithoutWin: 0,
      armedAtHead: null,
      lastEvaluatedHead: null
    };
  }
  function refreshCycleActiveFromLive(machine, _histories) {
    return machine;
  }
  function tablesExcludedFromRotation(machine) {
    const excluded = /* @__PURE__ */ new Set();
    for (const [key, count] of Object.entries(machine.tablePlacarLosses)) {
      if (Number(count) >= 1) excluded.add(Number(key));
    }
    if (machine.lastLostTableId != null) excluded.add(machine.lastLostTableId);
    return excluded;
  }
  function relaxTableExclusionsIfAllBlocked(machine, tableIds) {
    if (machine.recovery === 0 || tableIds.length === 0) return machine;
    const excluded = tablesExcludedFromRotation(machine);
    if (!tableIds.every((id) => excluded.has(id))) return machine;
    const last = machine.lastLostTableId;
    return {
      ...machine,
      tablePlacarLosses: last != null ? { [String(last)]: 1 } : {}
    };
  }
  function markTableSessionLoss(machine, tableId) {
    return {
      ...machine,
      tablePlacarLosses: { ...machine.tablePlacarLosses, [String(tableId)]: 1 },
      lastLostTableId: tableId
    };
  }
  function enterCrossingFromAlert(machine, alert, histories, recovery = machine.recovery) {
    return armCycleFromPick(clearPrepareState(machine), alert, histories, recovery);
  }
  function suspendAndPrepareNextTable(machine, lostTableId, recovery, tableIds, histories, minAbsenceSpins = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS) {
    const marked = markTableSessionLoss(machine, lostTableId);
    const cleared = { ...clearCycle(marked), recovery };
    const excluded = new Set(tablesExcludedFromRotation(cleared));
    excluded.add(lostTableId);
    const alert = pickGlobalCrossingAlertWithFallback(tableIds, histories, excluded, minAbsenceSpins);
    if (!alert || alert.tableId === lostTableId) {
      return { ...cleared, awaitSwitchNoTable: true };
    }
    return enterCrossingFromAlert(cleared, alert, histories);
  }
  function finishCycle(machine) {
    return {
      ...clearCycle(machine),
      recovery: 0,
      tablePlacarLosses: {},
      lastLostTableId: null,
      awaitSwitchNoTable: false,
      signalQueue: [],
      awaitingQueueTableId: null,
      awaitingQueueHead: null
    };
  }
  function scanRotatingRoomCrossingTables(tableIds, histories, activePick, minAbsenceSpins = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS) {
    return tableIds.map((tableId) => {
      const pick = bestPickForTable(tableId, histories[tableId] ?? [], minAbsenceSpins);
      if (!pick) {
        return { tableId, category: null, axis: null, bucketGap: 0, factor1Label: null, factor2Label: null, status: "idle", isAlertTable: false };
      }
      const active = buildCrossingActiveFromPick(pick);
      const fp = crossingFingerprint(pick.tableId, pick.axis, pick.category);
      const isActive = activePick != null && crossingFingerprint(activePick.tableId, activePick.axis, activePick.category) === fp;
      let status = "idle";
      if (isActive) status = "active";
      else if (pick) status = "alert";
      return {
        tableId,
        category: pick.category,
        axis: pick.axis,
        bucketGap: pick.bucketGap,
        factor1Label: active ? doisFatoresFactorLabel(active.factor1) : null,
        factor2Label: active ? doisFatoresFactorLabel(active.factor2) : null,
        status,
        isAlertTable: isActive
      };
    });
  }
  function buildRotatingRoomCrossingLiveView(tableIds, histories, machine, minAbsenceSpins = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS) {
    const globalPick = machine.cycleActive && machine.cycleTableId != null ? pickGlobalCrossingAlert(tableIds, histories, void 0, minAbsenceSpins) : pickGlobalCrossingAlert(tableIds, histories, void 0, minAbsenceSpins);
    let activePick = null;
    if (machine.cycleActive && machine.cycleTableId != null) {
      const axis = crossingAxisFromActive(machine.cycleActive);
      const category = machine.cycleMetricCategory;
      activePick = category != null ? pickForTableByCategory(
        machine.cycleTableId,
        histories[machine.cycleTableId] ?? [],
        axis,
        category
      ) : pickForTableOnAxis(machine.cycleTableId, histories[machine.cycleTableId] ?? [], axis, 0);
    }
    const displayPick = activePick ?? globalPick;
    let preparePick = null;
    if (machine.prepareTableId != null && machine.prepareFingerprint && !machine.cycleActive) {
      const entry = machine.pendingQueueEntry;
      if (entry && entry.tableId === machine.prepareTableId) {
        preparePick = pickForTableByCategory(
          entry.tableId,
          histories[entry.tableId] ?? [],
          entry.axis,
          entry.category
        );
      }
    }
    let mode = "scanning";
    if (machine.cycleActive) mode = "active";
    else if (machine.prepareFingerprint || preparePick) mode = "prepare";
    else if (machine.awaitSwitchNoTable && machine.recovery > 0) mode = "awaiting_queue";
    return {
      mode,
      globalPick: displayPick,
      preparePick,
      signalQueue: [],
      crossingScan: scanRotatingRoomCrossingTables(tableIds, histories, displayPick, minAbsenceSpins)
    };
  }
  function syncSpinHeads(machine, tableIds, histories) {
    const lastSpinHeadByTable = { ...machine.lastSpinHeadByTable };
    for (const tableId of tableIds) {
      lastSpinHeadByTable[String(tableId)] = spinHeadFromHistory(histories[tableId] ?? []);
    }
    return { ...machine, lastSpinHeadByTable };
  }
  function sanitizeRotatingRoomCrossingMachineForTableIds(machine, tableIds) {
    if (tableIds.length === 0) return machine;
    const allowed = new Set(tableIds);
    let next = machine;
    let changed = false;
    const apply = (m) => {
      if (m !== next) {
        next = m;
        changed = true;
      }
    };
    if (next.cycleTableId != null && !allowed.has(next.cycleTableId)) {
      apply(clearCycle(next));
    }
    if (next.prepareTableId != null && !allowed.has(next.prepareTableId) || next.pendingQueueEntry != null && !allowed.has(next.pendingQueueEntry.tableId)) {
      apply(clearPrepareState(next));
    }
    if (next.awaitingQueueTableId != null && !allowed.has(next.awaitingQueueTableId)) {
      next = { ...next, awaitingQueueTableId: null, awaitingQueueHead: null };
      changed = true;
    }
    const lastSpinHeadByTable = { ...next.lastSpinHeadByTable };
    let headsPruned = false;
    for (const key of Object.keys(lastSpinHeadByTable)) {
      const id = Number(key);
      if (!allowed.has(id)) {
        delete lastSpinHeadByTable[key];
        headsPruned = true;
      }
    }
    if (headsPruned) {
      next = { ...next, lastSpinHeadByTable };
      changed = true;
    }
    const tablePlacarLosses = { ...next.tablePlacarLosses };
    let lossesPruned = false;
    for (const key of Object.keys(tablePlacarLosses)) {
      const id = Number(key);
      if (!allowed.has(id)) {
        delete tablePlacarLosses[key];
        lossesPruned = true;
      }
    }
    if (lossesPruned) {
      next = { ...next, tablePlacarLosses };
      changed = true;
    }
    if (next.recovery === 0 && next.awaitSwitchNoTable) {
      next = { ...next, awaitSwitchNoTable: false };
      changed = true;
    }
    if (next.prepareFingerprint && next.prepareTableId == null) {
      apply(clearPrepareState(next));
    }
    if (next.awaitSwitchNoTable && next.recovery > 0 && next.prepareFingerprint) {
      apply(clearPrepareState(next));
    }
    if (next.awaitSwitchNoTable && next.recovery > 0 && tableIds.length > 0) {
      const relaxed = relaxTableExclusionsIfAllBlocked(next, tableIds);
      if (relaxed !== next) {
        next = relaxed;
        changed = true;
      }
    }
    return changed ? next : machine;
  }
  function tickRotatingRoomCrossingPlacar(tableIds, histories, machine, stats, maxRecovery = ROTATING_ROOM_CROSSING_MAX_RECOVERY, minAbsenceSpins = ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS) {
    let nextMachine = sanitizeRotatingRoomCrossingMachineForTableIds(
      syncSpinHeads(machine, tableIds, histories),
      tableIds
    );
    let nextStats = stats;
    let statsChanged = false;
    let flash = null;
    if (!nextMachine.cycleActive && nextMachine.prepareFingerprint && nextMachine.prepareTableId != null) {
      const pt = nextMachine.prepareTableId;
      const hist = histories[pt] ?? [];
      const freshPick = bestPickForTable(pt, hist, minAbsenceSpins);
      if (freshPick) {
        return {
          nextMachine: enterCrossingFromAlert(nextMachine, freshPick, histories),
          stats: nextStats,
          statsChanged,
          flash
        };
      }
      nextMachine = clearPrepareState(nextMachine);
    }
    if (!nextMachine.cycleActive) {
      if (nextMachine.awaitSwitchNoTable && nextMachine.recovery > 0) {
        nextMachine = relaxTableExclusionsIfAllBlocked(nextMachine, tableIds);
        const excluded2 = tablesExcludedFromRotation(nextMachine);
        const retry = pickGlobalCrossingAlertWithFallback(tableIds, histories, excluded2, minAbsenceSpins);
        if (retry) {
          return {
            nextMachine: enterCrossingFromAlert(nextMachine, retry, histories),
            stats: nextStats,
            statsChanged,
            flash
          };
        }
        return { nextMachine, stats: nextStats, statsChanged, flash };
      }
      const excluded = nextMachine.recovery > 0 ? tablesExcludedFromRotation(nextMachine) : void 0;
      const alert = pickGlobalCrossingAlertWithFallback(tableIds, histories, excluded, minAbsenceSpins);
      if (alert && !nextMachine.prepareFingerprint) {
        nextMachine = enterCrossingFromAlert(nextMachine, alert, histories);
        return { nextMachine, stats: nextStats, statsChanged, flash };
      }
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }
    const tableId = nextMachine.cycleTableId;
    if (tableId == null || !nextMachine.cycleActive) {
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }
    const history = histories[tableId] ?? [];
    if (history.length === 0) return { nextMachine, stats: nextStats, statsChanged, flash };
    const head = spinHeadFromHistory(history);
    if (head === nextMachine.armedAtHead || head === nextMachine.lastEvaluatedHead) {
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }
    const resultNumber = history[0];
    const activeForRound = nextMachine.cycleActive;
    nextMachine = { ...nextMachine, lastEvaluatedHead: head };
    const outcome = evaluateDoisFatoresRound(resultNumber, activeForRound);
    if (outcome === "W") {
      nextStats = recordRotatingRoomSessionWin(nextStats, nextMachine.recovery, maxRecovery);
      statsChanged = true;
      flash = { resultNumber, won: true, tableId, kind: "win", ...crossingFlashSnapshot(activeForRound, history, tableId, nextMachine) };
      nextMachine = finishCycle(nextMachine);
    } else if (outcome === "L") {
      const recoveryBefore = nextMachine.recovery;
      const recovery = recoveryBefore + 1;
      const canRotateTables = tableIds.length > 1;
      if (recovery > maxRecovery) {
        nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery);
        statsChanged = true;
        flash = { resultNumber, won: false, tableId, kind: "loss", ...crossingFlashSnapshot(activeForRound, history, tableId, nextMachine) };
        nextMachine = finishCycle(canRotateTables ? markTableSessionLoss(nextMachine, tableId) : nextMachine);
      } else {
        nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recoveryBefore, maxRecovery);
        statsChanged = true;
        flash = {
          resultNumber,
          won: false,
          tableId,
          kind: "recovery",
          switchedTable: canRotateTables
        };
        if (canRotateTables) {
          nextMachine = suspendAndPrepareNextTable(
            nextMachine,
            tableId,
            recovery,
            tableIds,
            histories,
            minAbsenceSpins
          );
        } else {
          nextMachine = { ...nextMachine, recovery };
          nextMachine = refreshCycleActiveFromLive(nextMachine, histories);
        }
      }
    } else {
      nextMachine = clearCycle(nextMachine);
    }
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }

  // src/lib/roulette/rotatingRoomCrossingSession.ts
  function defaultRotatingRoomCrossingMachineState() {
    return {
      cycleTableId: null,
      cycleFingerprint: null,
      cycleActive: null,
      recovery: 0,
      cycleSpinsWithoutWin: 0,
      armedAtHead: null,
      lastEvaluatedHead: null,
      lastSpinHeadByTable: {},
      signalQueue: [],
      awaitingQueueTableId: null,
      awaitingQueueHead: null,
      tablePlacarLosses: {},
      lastLostTableId: null,
      awaitSwitchNoTable: false,
      prepareFingerprint: null,
      prepareTableId: null,
      prepareActive: null,
      pendingQueueEntry: null,
      cycleMetricCategory: null,
      prepareSpinsWithoutPattern: 0
    };
  }
  function buildRotatingRoomCrossingSessionLiveView(tableIds, histories, machine) {
    return buildRotatingRoomCrossingLiveView(tableIds, histories, machine);
  }
  function tickRotatingRoomCrossingSessionPlacar(tableIds, histories, machine, stats) {
    return tickRotatingRoomCrossingPlacar(
      tableIds,
      histories,
      machine,
      stats,
      ROTATING_ROOM_CROSSING_MAX_RECOVERY
    );
  }

  // src/lib/roulette/umFatorStrategy.ts
  var UM_FATOR_MIN_HISTORY = 3;
  var UM_FATOR_MAX_RECOVERY = 5;
  function umFatorTriggerMatchCount(a, b) {
    if (a === 0 || b === 0) return 0;
    let count = 0;
    const colA = colorOf(a);
    const colB = colorOf(b);
    if (colA !== "Zero" && colA === colB) count += 1;
    const altA = heightOf(a);
    const altB = heightOf(b);
    if (altA !== "Zero" && altA === altB) count += 1;
    const parA = parityOf(a);
    const parB = parityOf(b);
    if (parA !== "Zero" && parA === parB) count += 1;
    return count;
  }
  function umFatorTriggerMatchTier(a, b) {
    const count = umFatorTriggerMatchCount(a, b);
    if (count === 2) return "two";
    if (count === 3) return "three";
    return null;
  }
  function umFatorTriggerMatchTierFromActive(active) {
    if (active.triggerMatchTier != null) return active.triggerMatchTier;
    const [nOlder, nNewer] = active.triggerNumbers;
    return umFatorTriggerMatchTier(nOlder, nNewer);
  }
  function umFatorTripleFactorsForNumber(n) {
    if (n === 0) return null;
    const col = colorOf(n);
    const alt = heightOf(n);
    const par = parityOf(n);
    if (col === "Zero" || alt === "Zero" || par === "Zero") return null;
    return [
      { kind: "cor", value: col },
      { kind: "altura", value: alt },
      { kind: "paridade", value: par }
    ];
  }
  function factorWins2(num, factor) {
    if (num === 0) return false;
    switch (factor.kind) {
      case "cor":
        return colorOf(num) === factor.value;
      case "paridade":
        return parityOf(num) === factor.value;
      case "altura":
        return heightOf(num) === factor.value;
    }
  }
  function oppositeFactor(f) {
    switch (f.kind) {
      case "cor":
        return { kind: "cor", value: f.value === "Vermelho" ? "Preto" : "Vermelho" };
      case "paridade":
        return { kind: "paridade", value: f.value === "Par" ? "Impar" : "Par" };
      case "altura":
        return { kind: "altura", value: f.value === "Baixo" ? "Alto" : "Baixo" };
    }
  }
  function umFatorSharedFactorsBetween(a, b) {
    if (a === 0 || b === 0) return [];
    const triple = umFatorTripleFactorsForNumber(a);
    if (!triple) return [];
    return triple.filter((f) => factorWins2(b, f));
  }
  function umFatorMatchCountOnTriple(num, triple) {
    if (num === 0) return 0;
    return triple.filter((f) => factorWins2(num, f)).length;
  }
  function umFatorMatchCountWithReference(num, ref) {
    if (num === 0 || ref === 0) return 0;
    const triple = umFatorTripleFactorsForNumber(ref);
    if (!triple) return 0;
    return triple.filter((f) => factorWins2(num, f)).length;
  }
  function buildUmFatorActive(n0, n1, n2, trigger, shared, alertFactor, triggerMatchTier) {
    const sharedLabel = shared.map(doisFatoresFactorLabel).join(" \xB7 ");
    const tierTag = triggerMatchTier === "three" ? "3g" : "2g";
    return {
      pairKind: "cor-altura",
      pairKindLabel: "Cor \xB7 Altura \xB7 Paridade",
      triggerFactor1: trigger[0],
      triggerFactor2: trigger[1],
      triggerFactor3: trigger[2],
      alertFactor,
      triggerNumbers: [n2, n1],
      resultNumber: n0,
      triggerMatchTier,
      armingDescription: `1 Fator (${tierTag}): gatilho ${sharedLabel} (${n2}, ${n1}) \u2192 alerta ${doisFatoresFactorLabel(alertFactor)} (aguarda pr\xF3ximo giro)`
    };
  }
  function detectUmFatorThreeTierActive(n0, n1, n2) {
    if (umFatorTriggerMatchCount(n1, n2) !== 3) return null;
    const trigger = umFatorTripleFactorsForNumber(n1);
    if (!trigger) return null;
    const matchOnCurrent = umFatorMatchCountOnTriple(n0, trigger);
    if (matchOnCurrent !== 2) return null;
    const alertFactor = trigger.find((f) => !factorWins2(n0, f));
    if (!alertFactor) return null;
    return buildUmFatorActive(n0, n1, n2, trigger, trigger, alertFactor, "three");
  }
  function detectUmFatorTwoTierActive(n0, n1, n2) {
    if (umFatorTriggerMatchCount(n1, n2) !== 2) return null;
    const trigger = umFatorTripleFactorsForNumber(n1);
    if (!trigger) return null;
    const shared = umFatorSharedFactorsBetween(n1, n2);
    if (shared.length !== 2) return null;
    const matchOnShared = shared.filter((f) => factorWins2(n0, f)).length;
    if (matchOnShared !== 1) return null;
    if (umFatorMatchCountWithReference(n0, n1) !== 1) return null;
    const missingOnT0 = shared.find((f) => !factorWins2(n0, f));
    if (!missingOnT0) return null;
    const alertFactor = oppositeFactor(missingOnT0);
    return buildUmFatorActive(n0, n1, n2, trigger, shared, alertFactor, "two");
  }
  function detectUmFatorActiveFromHistory(historyNewestFirst, isTierEnabled = isUmFatorTriggerTierEnabled) {
    if (historyNewestFirst.length < UM_FATOR_MIN_HISTORY) return null;
    const n0 = historyNewestFirst[0];
    const n1 = historyNewestFirst[1];
    const n2 = historyNewestFirst[2];
    if (n0 === 0 || n1 === 0 || n2 === 0) return null;
    const three = detectUmFatorThreeTierActive(n0, n1, n2);
    if (three && isTierEnabled("three")) return three;
    const two = detectUmFatorTwoTierActive(n0, n1, n2);
    if (two && isTierEnabled("two")) return two;
    return null;
  }
  function evaluateUmFatorRound(num, active) {
    if (num === 0) return "L";
    return factorWins2(num, active.alertFactor) ? "W" : "L";
  }
  function umFatorAlertLabel(active) {
    return doisFatoresFactorLabel(active.alertFactor);
  }
  function umFatorToTapeteActive(active) {
    return {
      pairKind: active.pairKind,
      pairKindLabel: active.pairKindLabel,
      patternMode: "convergence",
      patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
      referenceNumber: active.resultNumber,
      factor1: active.alertFactor,
      factor2: active.triggerFactor1,
      triggerNumbers: active.triggerNumbers,
      armingDescription: active.armingDescription
    };
  }

  // src/lib/roulette/umFatorTriggerAutoSelect.ts
  function defaultUmFatorTriggerAutoSelectFields() {
    return {
      autoPreferredTier: null,
      sequenceLockedTier: null
    };
  }
  function resolveUmFatorSequenceLockedTier(ctx) {
    if (ctx.sequenceLockedTier != null) return ctx.sequenceLockedTier;
    if (ctx.recovery > 0 && ctx.lastActiveTriggerTier != null) return ctx.lastActiveTriggerTier;
    return null;
  }
  function buildUmFatorTriggerTierGate(ctx, isAdminEnabled = isUmFatorTriggerTierEnabled) {
    const locked = resolveUmFatorSequenceLockedTier(ctx);
    return (tier) => {
      if (!isAdminEnabled(tier)) return false;
      if (tier === "two") return false;
      if (ctx.recovery > 0 && locked != null) return tier === locked;
      return true;
    };
  }
  function applyUmFatorSequenceStart(fields, recovery, formationTier) {
    if (formationTier == null) return fields;
    if (recovery > 0 && fields.sequenceLockedTier != null) return fields;
    return { ...fields, sequenceLockedTier: formationTier };
  }
  function applyUmFatorSequenceEnd(fields) {
    if (fields.sequenceLockedTier == null) return fields;
    return { ...fields, sequenceLockedTier: null };
  }
  function applyUmFatorTriggerSwitchAfterPartialLoss(fields, _recoveryBefore, _matchTier, _nextRecovery) {
    return fields;
  }

  // src/lib/roulette/rotatingRoomLobbySignal.ts
  var ROTATING_ROOM_ROUND_FLASH_MS = 2800;
  var ROTATING_ROOM_LOBBY_RETURN_DELAY_MS = 2e3;
  var ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT = ROTATING_ROOM_ROUND_FLASH_MS + ROTATING_ROOM_LOBBY_RETURN_DELAY_MS;
  var ROTATING_ROOM_LOBBY_COOLDOWN_MS = 3e3;
  var ROTATING_ROOM_LOBBY_NAV_SETTLE_MS = 6500;
  function rotatingRoomLobbyCooldownUntilMs(fromMs = Date.now()) {
    return fromMs + ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT + ROTATING_ROOM_LOBBY_NAV_SETTLE_MS + ROTATING_ROOM_LOBBY_COOLDOWN_MS;
  }
  function isRotatingRoomLobbyCooldownActive(lobbyCooldownUntilMs, nowMs = Date.now()) {
    return typeof lobbyCooldownUntilMs === "number" && Number.isFinite(lobbyCooldownUntilMs) && nowMs < lobbyCooldownUntilMs;
  }
  function isRotatingRoomPostResultHoldActive(postResultHoldUntilMs, nowMs = Date.now()) {
    return typeof postResultHoldUntilMs === "number" && Number.isFinite(postResultHoldUntilMs) && nowMs < postResultHoldUntilMs;
  }

  // src/lib/roulette/rotatingRoomUmFatorStrategy.ts
  function detectUmFatorFormationForMachine(machine, history) {
    const gate = buildUmFatorTriggerTierGate({
      autoPreferredTier: machine.autoPreferredTier,
      sequenceLockedTier: machine.sequenceLockedTier,
      recovery: machine.recovery,
      lastActiveTriggerTier: machine.lastActive?.triggerMatchTier ?? null
    });
    return detectUmFatorActiveFromHistory(history, gate);
  }
  function mergeTriggerAutoSelectFields(machine, patch) {
    return {
      ...machine,
      autoPreferredTier: patch.autoPreferredTier,
      sequenceLockedTier: patch.sequenceLockedTier
    };
  }
  function spinHead(history) {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }
  function defaultUmFatorMachineState() {
    return {
      recovery: 0,
      lastEvaluatedHead: null,
      lastSpinHeadByTable: {},
      pendingByTable: {},
      settledSpinHeadByTable: {},
      tablePlacarLosses: {},
      lastLostTableId: null,
      lastActive: null,
      lastActiveTableId: null,
      focusLockTableId: null,
      staleFormationHeadByTable: {},
      lobbyCooldownUntilMs: null,
      lobbyArmingGateByTable: {},
      postResultHoldUntilMs: null,
      postResultHoldTableId: null,
      ...defaultUmFatorTriggerAutoSelectFields()
    };
  }
  function snapshotSpinHeadsByTable(tableIds, histories) {
    const heads = {};
    for (const tableId of tableIds) {
      heads[String(tableId)] = spinHead(histories[tableId] ?? []);
    }
    return heads;
  }
  function isBlockedByLobbyArmingGate(machine, tableId, head) {
    const gate = machine.lobbyArmingGateByTable?.[String(tableId)];
    return gate != null && gate === head;
  }
  function refreshLobbyArmingGateIfReady(machine, tableIds, histories) {
    if (machine.lobbyCooldownUntilMs == null) return machine;
    if (isRotatingRoomLobbyCooldownActive(machine.lobbyCooldownUntilMs)) return machine;
    return {
      ...machine,
      lobbyCooldownUntilMs: null,
      lobbyArmingGateByTable: snapshotSpinHeadsByTable(tableIds, histories)
    };
  }
  function clearExpiredPostResultHold(machine) {
    if (!isRotatingRoomPostResultHoldActive(machine.postResultHoldUntilMs)) {
      if (machine.postResultHoldUntilMs == null && machine.postResultHoldTableId == null) {
        return machine;
      }
      return {
        ...machine,
        postResultHoldUntilMs: null,
        postResultHoldTableId: null
      };
    }
    return machine;
  }
  function beginPostResultLobbyHold(machine, tableId, fromMs = Date.now()) {
    return {
      ...machine,
      postResultHoldUntilMs: fromMs + ROTATING_ROOM_MS_BEFORE_LOBBY_WAIT,
      postResultHoldTableId: tableId
    };
  }
  function isResultAlreadySettled(machine, tableId, head) {
    return machine.settledSpinHeadByTable[String(tableId)] === head;
  }
  function sameUmFatorTriggerPair(a, b) {
    return a[0] === b[0] && a[1] === b[1];
  }
  function shouldSkipTableForFormation(machine, tableId, formation) {
    if (machine.recovery > 0 && machine.lastLostTableId === tableId) return true;
    if ((machine.tablePlacarLosses[String(tableId)] ?? 0) >= 1) return true;
    if (machine.lastActiveTableId === tableId && machine.lastActive != null && sameUmFatorTriggerPair(formation.triggerNumbers, machine.lastActive.triggerNumbers)) {
      return true;
    }
    return false;
  }
  function isStaleQueuedFormation(machine, tableId, head) {
    const blocked = machine.staleFormationHeadByTable[String(tableId)];
    return blocked != null && blocked === head;
  }
  function snapshotStaleFormationHeads(machine, tableIds, histories) {
    const stale = { ...machine.staleFormationHeadByTable };
    for (const tableId of tableIds) {
      stale[String(tableId)] = spinHead(histories[tableId] ?? []);
    }
    return stale;
  }
  function pendingForTable(machine, tableId) {
    return machine.pendingByTable[String(tableId)] ?? null;
  }
  function isPendingEntryOpen(machine, tableId, history) {
    const pending = pendingForTable(machine, tableId);
    if (!pending) return false;
    const head = spinHead(history);
    return !isResultAlreadySettled(machine, tableId, head);
  }
  function anyTablePendingEntryOpen(machine, tableIds, histories) {
    return findLockedPendingTable(machine, tableIds, histories) != null;
  }
  function findLockedPendingTable(machine, tableIds, histories) {
    if (machine.focusLockTableId != null && tableIds.includes(machine.focusLockTableId)) {
      const history = histories[machine.focusLockTableId] ?? [];
      if (isPendingEntryOpen(machine, machine.focusLockTableId, history)) {
        return machine.focusLockTableId;
      }
    }
    for (const tableId of tableIds) {
      if (isPendingEntryOpen(machine, tableId, histories[tableId] ?? [])) {
        return tableId;
      }
    }
    return null;
  }
  function pruneOrphanUmFatorPending(machine) {
    const lock = machine.focusLockTableId;
    if (lock == null) {
      if (Object.keys(machine.pendingByTable).length === 0) return machine;
      return { ...machine, pendingByTable: {} };
    }
    const pendingByTable = { ...machine.pendingByTable };
    let changed = false;
    for (const k of Object.keys(pendingByTable)) {
      if (Number(k) !== lock) {
        delete pendingByTable[k];
        changed = true;
      }
    }
    return changed ? { ...machine, pendingByTable } : machine;
  }
  function pendingReadyToEvaluate(machine, tableId, head) {
    const pending = pendingForTable(machine, tableId);
    return pending != null && pending.armedHead !== head;
  }
  function orderTableIdsForTick(tableIds, histories, machine) {
    const needsEval = [];
    const withPending = [];
    const withFormation = [];
    const rest = [];
    for (const tableId of tableIds) {
      const history = histories[tableId] ?? [];
      const head = spinHead(history);
      if (pendingReadyToEvaluate(machine, tableId, head)) {
        needsEval.push(tableId);
      } else if (pendingForTable(machine, tableId) != null) {
        withPending.push(tableId);
      } else if (!isResultAlreadySettled(machine, tableId, head) && !isStaleQueuedFormation(machine, tableId, head) && !isBlockedByLobbyArmingGate(machine, tableId, head) && detectUmFatorFormationForMachine(machine, history) != null && tableArmableForUmFatorFormation(tableId, history)) {
        withFormation.push(tableId);
      } else {
        rest.push(tableId);
      }
    }
    const sortIds = (ids) => ids.sort((a, b) => a - b);
    return [
      ...sortIds(needsEval),
      ...sortIds(withPending),
      ...sortIds(withFormation),
      ...sortIds(rest)
    ];
  }
  function activeForDisplay(machine, tableId, history) {
    const head = spinHead(history);
    const pending = pendingForTable(machine, tableId);
    if (!pending) return null;
    if (isResultAlreadySettled(machine, tableId, head)) return null;
    return pending.active;
  }
  function scanUmFatorTables(tableIds, histories, machine) {
    const lockedTable = findLockedPendingTable(machine, tableIds, histories);
    return tableIds.map((tableId) => {
      const h = histories[tableId] ?? [];
      const active = activeForDisplay(machine, tableId, h);
      const formation = lockedTable != null ? null : h.length >= 3 && !active && !isStaleQueuedFormation(machine, tableId, spinHead(h)) ? detectUmFatorFormationForMachine(machine, h) : null;
      return {
        tableId,
        hasTriggerPair: h.length >= 3 && umFatorTriggerMatchCount(h[1], h[2]) >= 2,
        alertLabel: active ? umFatorAlertLabel(active) : formation ? umFatorAlertLabel(formation) : null,
        status: active ? "alert" : formation ? "formation" : "idle"
      };
    });
  }
  function pickGlobalUmFatorAlert(tableIds, histories, machine) {
    const lockedTable = findLockedPendingTable(machine, tableIds, histories);
    if (lockedTable != null) {
      const active = activeForDisplay(machine, lockedTable, histories[lockedTable] ?? []);
      if (active) return { tableId: lockedTable, active };
      return null;
    }
    const picks = [];
    for (const tableId of tableIds) {
      const history = histories[tableId] ?? [];
      const active = activeForDisplay(machine, tableId, history);
      if (active) picks.push({ tableId, active });
    }
    if (picks.length === 0) return null;
    if (machine.lastActiveTableId != null) {
      const sticky = picks.find((p) => p.tableId === machine.lastActiveTableId);
      if (sticky) return sticky;
    }
    picks.sort((a, b) => a.tableId - b.tableId);
    return picks[0];
  }
  function buildUmFatorLiveView(tableIds, histories, machine) {
    const pick = pickGlobalUmFatorAlert(tableIds, histories, machine);
    return {
      globalTableId: pick?.tableId ?? null,
      globalActive: pick?.active ?? null,
      tableScan: scanUmFatorTables(tableIds, histories, machine)
    };
  }
  function tickUmFatorPlacar(tableIds, histories, machine, stats, maxRecovery = UM_FATOR_MAX_RECOVERY) {
    let nextMachine = pruneOrphanUmFatorPending(machine);
    nextMachine = clearExpiredPostResultHold(nextMachine);
    nextMachine = refreshLobbyArmingGateIfReady(nextMachine, tableIds, histories);
    nextMachine = {
      ...nextMachine,
      lastSpinHeadByTable: { ...nextMachine.lastSpinHeadByTable },
      pendingByTable: { ...nextMachine.pendingByTable },
      settledSpinHeadByTable: { ...nextMachine.settledSpinHeadByTable ?? {} }
    };
    let nextStats = stats;
    let statsChanged = false;
    let flash = null;
    const globalHead = tableIds.map((id) => `${id}:${spinHead(histories[id] ?? [])}`).join("|");
    const lobbyCooldownActive = isRotatingRoomLobbyCooldownActive(nextMachine.lobbyCooldownUntilMs);
    const hasWork = tableIds.some((tableId) => {
      const history = histories[tableId] ?? [];
      const head = spinHead(history);
      if (pendingReadyToEvaluate(nextMachine, tableId, head)) return true;
      if (pendingForTable(nextMachine, tableId) != null) return false;
      if (isResultAlreadySettled(nextMachine, tableId, head)) return false;
      if (lobbyCooldownActive) return false;
      if (isBlockedByLobbyArmingGate(nextMachine, tableId, head)) return false;
      return !isStaleQueuedFormation(nextMachine, tableId, head) && detectUmFatorFormationForMachine(machine, history) != null && tableArmableForUmFatorFormation(tableId, history);
    });
    if (globalHead === machine.lastEvaluatedHead && !hasWork) {
      return { nextMachine, stats: nextStats, statsChanged, flash };
    }
    const orderedIds = orderTableIdsForTick(tableIds, histories, nextMachine);
    for (const tableId of orderedIds) {
      const history = histories[tableId] ?? [];
      const head = spinHead(history);
      const prevHead = machine.lastSpinHeadByTable[String(tableId)];
      const headChanged = head !== prevHead;
      if (headChanged) {
        nextMachine.lastSpinHeadByTable[String(tableId)] = head;
      }
      const pending = pendingForTable(nextMachine, tableId);
      if (pending && pending.armedHead !== head) {
        const resultNumber = history[0];
        const outcome = evaluateUmFatorRound(resultNumber, pending.active);
        const recoveryBefore = nextMachine.recovery;
        const matchTier = umFatorTriggerMatchTierFromActive(pending.active);
        const pendingByTable = { ...nextMachine.pendingByTable };
        delete pendingByTable[String(tableId)];
        nextMachine = {
          ...nextMachine,
          pendingByTable,
          lastActive: pending.active,
          lastActiveTableId: tableId,
          focusLockTableId: null,
          settledSpinHeadByTable: {
            ...nextMachine.settledSpinHeadByTable,
            [String(tableId)]: head
          },
          staleFormationHeadByTable: snapshotStaleFormationHeads(nextMachine, tableIds, histories)
        };
        if (outcome === "W") {
          nextStats = recordRotatingRoomSessionWin(nextStats, recoveryBefore, maxRecovery);
          if (matchTier != null) nextStats = recordUmFatorMatchTierWin(nextStats, matchTier);
          statsChanged = true;
          nextMachine.recovery = 0;
          nextMachine.tablePlacarLosses = {};
          nextMachine.lastLostTableId = null;
          nextMachine.lobbyCooldownUntilMs = rotatingRoomLobbyCooldownUntilMs();
          nextMachine.lobbyArmingGateByTable = {};
          nextMachine = beginPostResultLobbyHold(nextMachine, tableId);
          nextMachine = mergeTriggerAutoSelectFields(
            nextMachine,
            applyUmFatorSequenceEnd({
              autoPreferredTier: nextMachine.autoPreferredTier,
              sequenceLockedTier: nextMachine.sequenceLockedTier
            })
          );
          flash = {
            resultNumber,
            won: true,
            tableId,
            kind: "win",
            factor1: pending.active.alertFactor,
            triggerNumbers: history.slice(0, 4)
          };
        } else {
          const nextRecovery = recoveryBefore + 1;
          if (matchTier != null) nextStats = recordUmFatorMatchTierLoss(nextStats, matchTier);
          if (nextRecovery > maxRecovery) {
            nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery);
            statsChanged = true;
            nextMachine.recovery = 0;
            nextMachine.tablePlacarLosses = { [String(tableId)]: 1 };
            nextMachine.lastLostTableId = tableId;
            nextMachine.lobbyCooldownUntilMs = rotatingRoomLobbyCooldownUntilMs();
            nextMachine.lobbyArmingGateByTable = {};
            nextMachine = beginPostResultLobbyHold(nextMachine, tableId);
            nextMachine = mergeTriggerAutoSelectFields(
              nextMachine,
              applyUmFatorSequenceEnd({
                autoPreferredTier: nextMachine.autoPreferredTier,
                sequenceLockedTier: nextMachine.sequenceLockedTier
              })
            );
            flash = {
              resultNumber,
              won: false,
              tableId,
              kind: "loss",
              factor1: pending.active.alertFactor,
              triggerNumbers: history.slice(0, 4)
            };
          } else {
            nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recoveryBefore, maxRecovery);
            statsChanged = true;
            nextMachine.recovery = nextRecovery;
            nextMachine.lastLostTableId = tableId;
            nextMachine = mergeTriggerAutoSelectFields(
              nextMachine,
              applyUmFatorTriggerSwitchAfterPartialLoss(
                {
                  autoPreferredTier: nextMachine.autoPreferredTier,
                  sequenceLockedTier: nextMachine.sequenceLockedTier
                },
                recoveryBefore,
                matchTier,
                nextRecovery
              )
            );
            flash = { resultNumber, won: false, tableId, kind: "recovery" };
          }
        }
        break;
      }
      if (pending) continue;
      if (isResultAlreadySettled(nextMachine, tableId, head)) continue;
      if (anyTablePendingEntryOpen(nextMachine, tableIds, histories)) continue;
      if (lobbyCooldownActive) continue;
      const formation = detectUmFatorFormationForMachine(nextMachine, history);
      if (!formation) continue;
      if (shouldSkipTableForFormation(nextMachine, tableId, formation)) continue;
      if (isStaleQueuedFormation(nextMachine, tableId, head)) continue;
      if (isBlockedByLobbyArmingGate(nextMachine, tableId, head)) continue;
      if (!headChanged) continue;
      if (!tableAcceptableForRotatingRoomEntry(tableId, history)) continue;
      if (!tableArmableForUmFatorFormation(tableId, history)) continue;
      const formationTier = umFatorTriggerMatchTierFromActive(formation);
      const autoFields = applyUmFatorSequenceStart(
        {
          autoPreferredTier: nextMachine.autoPreferredTier,
          sequenceLockedTier: nextMachine.sequenceLockedTier
        },
        nextMachine.recovery,
        formationTier
      );
      nextMachine = {
        ...mergeTriggerAutoSelectFields(nextMachine, autoFields),
        pendingByTable: {
          ...nextMachine.pendingByTable,
          [String(tableId)]: { active: formation, armedHead: head }
        },
        lastActive: formation,
        lastActiveTableId: tableId,
        focusLockTableId: tableId,
        lobbyArmingGateByTable: {}
      };
      break;
    }
    nextMachine.lastEvaluatedHead = globalHead;
    return { nextMachine, stats: nextStats, statsChanged, flash };
  }
  function sanitizeUmFatorMachineForTableIds(machine, tableIds) {
    const allowed = new Set(tableIds.map(String));
    const lastSpinHeadByTable = {};
    for (const [k, v] of Object.entries(machine.lastSpinHeadByTable)) {
      if (allowed.has(k)) lastSpinHeadByTable[k] = v;
    }
    const settledSpinHeadByTable = {};
    for (const [k, v] of Object.entries(machine.settledSpinHeadByTable ?? {})) {
      if (allowed.has(k)) settledSpinHeadByTable[k] = v;
    }
    const pendingByTable = {};
    for (const [k, v] of Object.entries(machine.pendingByTable ?? {})) {
      if (allowed.has(k)) pendingByTable[k] = v;
    }
    const staleFormationHeadByTable = {};
    for (const [k, v] of Object.entries(machine.staleFormationHeadByTable ?? {})) {
      if (allowed.has(k)) staleFormationHeadByTable[k] = v;
    }
    const lobbyArmingGateByTable = {};
    for (const [k, v] of Object.entries(machine.lobbyArmingGateByTable ?? {})) {
      if (allowed.has(k)) lobbyArmingGateByTable[k] = v;
    }
    const lastActiveTableId = machine.lastActiveTableId != null && tableIds.includes(machine.lastActiveTableId) ? machine.lastActiveTableId : null;
    const focusLockTableId = machine.focusLockTableId != null && tableIds.includes(machine.focusLockTableId) ? machine.focusLockTableId : null;
    const postResultHoldTableId = machine.postResultHoldTableId != null && tableIds.includes(machine.postResultHoldTableId) ? machine.postResultHoldTableId : null;
    const postResultHoldUntilMs = typeof machine.postResultHoldUntilMs === "number" && Number.isFinite(machine.postResultHoldUntilMs) ? machine.postResultHoldUntilMs : null;
    return {
      ...machine,
      lastSpinHeadByTable,
      pendingByTable,
      settledSpinHeadByTable,
      staleFormationHeadByTable,
      lobbyArmingGateByTable,
      postResultHoldUntilMs,
      postResultHoldTableId,
      tablePlacarLosses: {},
      lastLostTableId: null,
      lastActiveTableId,
      focusLockTableId
    };
  }

  // src/lib/roulette/rotatingRoomRotativaMerge.ts
  function umFatorInCycleFromView(um) {
    return um.showTapeteSignal || um.currentRecovery > 0 || isRotatingRoomLobbyCooldownActive(um.lobbyCooldownUntilMs) || isRotatingRoomPostResultHoldActive(um.postResultHoldUntilMs);
  }
  function crossingInCycleFromView(cross) {
    return cross.showTapeteSignal || cross.currentRecovery > 0 || cross.sessionMode === "prepare";
  }
  function crossingHasQualifyingPatternFromView(cross) {
    return cross.crossingScan.some(
      (row) => row.status === "alert" || row.status === "active" || row.status === "prepare"
    );
  }
  function resolveRotativaTriggerFromSnapshot(snapshot, crossingEnabled) {
    if (!crossingEnabled) return "umFator";
    const um = snapshot.um1fator;
    const crossing = snapshot.dois2fatores;
    const umBusy = umFatorInCycleFromView(um);
    const crossBusy = crossingInCycleFromView(crossing);
    if (umBusy && !crossBusy) return "umFator";
    if (crossBusy && !umBusy) return "crossing";
    if (crossBusy && umBusy) {
      if (crossing.showTapeteSignal || crossing.sessionMode === "prepare") return "crossing";
      if (um.showTapeteSignal) return "umFator";
      if (crossing.currentRecovery >= um.currentRecovery) return "crossing";
      return "umFator";
    }
    if (crossingHasQualifyingPatternFromView(crossing) && crossing.prepareTableId != null) {
      return "crossing";
    }
    if (crossingEnabled) return "crossing";
    return "umFator";
  }

  // extension/strategy-entry.ts
  var ROTATING_ROOM_TABLE_IDS = buildRotatingRoomTableIds(206);
  var BASE_STAKE = 50;
  var EXTENSION_MAX_GALES = 6;
  function clampExtensionMaxRecovery(value, fallback = UM_FATOR_MAX_RECOVERY) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return Math.min(EXTENSION_MAX_GALES, Math.max(0, fallback));
    return Math.min(EXTENSION_MAX_GALES, Math.max(0, Math.floor(n)));
  }
  function stakeForRecovery(recovery, maxRecovery) {
    const level = Math.min(Math.max(0, recovery), maxRecovery);
    return BASE_STAKE * 2 ** level;
  }
  function buildTriggerSnapshot(umMachine, umStats, umView, crossingMachine, crossingStats, crossingView, tableIds) {
    const showUmTapete = umView.globalActive != null && umView.globalTableId != null;
    const crossingActive = crossingMachine.cycleActive;
    const crossingTableId = crossingMachine.cycleTableId != null && tableIds.includes(crossingMachine.cycleTableId) ? crossingMachine.cycleTableId : null;
    const showCrossTapete = crossingActive != null && crossingTableId != null;
    return {
      revision: 0,
      updatedAt: Date.now(),
      rotatingRoomTableIds: [...tableIds],
      tableHistories: {},
      um1fator: {
        phase: showUmTapete ? "active" : "waiting",
        sessionStats: umStats,
        showTapeteSignal: showUmTapete,
        singleFactorMode: true,
        currentRecovery: umMachine.recovery,
        currentTableId: showUmTapete ? umView.globalTableId : null,
        alertCategory: umView.globalActive?.armingDescription ?? null,
        alertBucketGap: 0,
        sessionMode: showUmTapete ? "active" : "scanning",
        umFatorScan: umView.tableScan,
        activeCrossing: showUmTapete && umView.globalActive ? umFatorToTapeteActive(umView.globalActive) : null,
        umActive: showUmTapete ? umView.globalActive : null,
        lobbyCooldownUntilMs: umMachine.lobbyCooldownUntilMs,
        postResultHoldUntilMs: umMachine.postResultHoldUntilMs,
        postResultHoldTableId: umMachine.postResultHoldTableId
      },
      dois2fatores: {
        phase: showCrossTapete ? "active" : "waiting",
        sessionStats: crossingStats,
        showTapeteSignal: showCrossTapete,
        currentRecovery: crossingMachine.recovery,
        currentTableId: showCrossTapete ? crossingTableId : null,
        prepareTableId: crossingMachine.prepareTableId != null && tableIds.includes(crossingMachine.prepareTableId) ? crossingMachine.prepareTableId : null,
        alertCategory: crossingView.globalPick?.category ?? null,
        alertBucketGap: crossingView.globalPick?.bucketGap ?? 0,
        sessionMode: crossingView.mode,
        prepareCategory: crossingView.preparePick?.category ?? null,
        crossingScan: crossingView.crossingScan,
        activeCrossing: showCrossTapete ? crossingActive : null
      },
      lifetime: {
        dois2fatores: { since: 0, wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] },
        um1fator: { since: 0, wins: 0, losses: 0, winsAtRecovery: [], lossesAtRecovery: [] }
      },
      ledgerTail: { dois2fatores: [], um1fator: [] }
    };
  }
  function buildActiveView(trigger, umView, umMachine, crossingMachine, crossingView, tableIds) {
    if (trigger === "crossing") {
      const crossingActive = crossingMachine.cycleActive;
      const tableId2 = crossingMachine.cycleTableId != null && tableIds.includes(crossingMachine.cycleTableId) ? crossingMachine.cycleTableId : null;
      const showTapete2 = crossingActive != null && tableId2 != null;
      const head = crossingMachine.lastEvaluatedHead ?? `s${crossingMachine.cycleSpinsWithoutWin}`;
      const betAttemptKey2 = showTapete2 && tableId2 != null && crossingActive ? `${tableId2}:${crossingActive.pairKind}:${crossingMachine.recovery}:${head}` : null;
      return {
        trigger,
        showTapeteSignal: showTapete2,
        currentTableId: tableId2,
        currentRecovery: crossingMachine.recovery,
        singleFactorMode: false,
        sessionMode: crossingView.mode,
        activeCrossing: showTapete2 ? crossingActive : null,
        umActive: null,
        betAttemptKey: betAttemptKey2
      };
    }
    const tableId = umView.globalTableId;
    const umActive = umView.globalActive;
    const showTapete = umActive != null && tableId != null;
    const betAttemptKey = showTapete && umActive ? `${tableId}:${umActive.resultNumber}:${umActive.alertFactor.kind}:${umMachine.recovery}` : null;
    return {
      trigger: "umFator",
      showTapeteSignal: showTapete,
      currentTableId: tableId,
      currentRecovery: umMachine.recovery,
      singleFactorMode: true,
      sessionMode: showTapete ? "active" : "scanning",
      activeCrossing: showTapete && umActive ? umFatorToTapeteActive(umActive) : null,
      umActive: showTapete ? umActive : null,
      betAttemptKey
    };
  }
  function createRotativaEngine(tableIdsOrOptions = ROTATING_ROOM_TABLE_IDS) {
    const opts = Array.isArray(tableIdsOrOptions) ? { tableIds: tableIdsOrOptions } : tableIdsOrOptions;
    const ids = [...opts.tableIds ?? ROTATING_ROOM_TABLE_IDS];
    const maxRecovery = clampExtensionMaxRecovery(opts.maxRecovery);
    const crossingMaxRecovery = Math.min(maxRecovery, ROTATING_ROOM_CROSSING_MAX_RECOVERY);
    const crossingEnabled = opts.crossingEnabled !== false;
    let umMachine = sanitizeUmFatorMachineForTableIds(defaultUmFatorMachineState(), ids);
    let umStats = opts.initialUmStats != null ? parseRotatingRoomSessionStats(opts.initialUmStats, maxRecovery) : emptyRotatingRoomSessionStats(maxRecovery);
    let crossingMachine = sanitizeRotatingRoomCrossingMachineForTableIds(
      defaultRotatingRoomCrossingMachineState(),
      ids
    );
    let crossingStats = opts.initialCrossingStats != null ? parseRotatingRoomSessionStats(opts.initialCrossingStats, crossingMaxRecovery) : emptyRotatingRoomSessionStats(crossingMaxRecovery);
    const histories = {};
    const lastGameIdByTable = {};
    const spinBaselinedByTable = {};
    const lastLiveSpinAtByTable = {};
    const lastAnchoredHeadByTable = {};
    for (const id of ids) histories[id] = [];
    function expireExtensionStalePending() {
      const now = Date.now();
      const maxAgeMs = (EXTENSION_PRE_BET_WAIT_SEC + LIVE_TABLE_BETTING_WINDOW_SEC) * 1e3;
      const pendingByTable = { ...umMachine.pendingByTable };
      let changed = false;
      for (const tableId of ids) {
        if (!pendingByTable[String(tableId)]) continue;
        const at = lastLiveSpinAtByTable[tableId];
        if (at != null && now - at < maxAgeMs) continue;
        delete pendingByTable[String(tableId)];
        changed = true;
      }
      if (!changed) return;
      umMachine = { ...umMachine, pendingByTable, focusLockTableId: null };
    }
    function runTick() {
      expireExtensionStalePending();
      const crossingTick = crossingEnabled ? tickRotatingRoomCrossingSessionPlacar(ids, histories, crossingMachine, crossingStats) : {
        nextMachine: crossingMachine,
        stats: crossingStats,
        statsChanged: false,
        flash: null
      };
      crossingMachine = sanitizeRotatingRoomCrossingMachineForTableIds(crossingTick.nextMachine, ids);
      crossingStats = crossingTick.stats;
      const umTick = tickUmFatorPlacar(ids, histories, umMachine, umStats, maxRecovery);
      umMachine = umTick.nextMachine;
      umStats = umTick.stats;
      const umView = buildUmFatorLiveView(ids, histories, umMachine);
      const crossingView = buildRotatingRoomCrossingSessionLiveView(ids, histories, crossingMachine);
      const snapshot = buildTriggerSnapshot(
        umMachine,
        umStats,
        umView,
        crossingMachine,
        crossingStats,
        crossingView,
        ids
      );
      const trigger = resolveRotativaTriggerFromSnapshot(snapshot, crossingEnabled);
      const active = buildActiveView(trigger, umView, umMachine, crossingMachine, crossingView, ids);
      return {
        trigger,
        umFlash: umTick.flash,
        crossingFlash: crossingTick.flash,
        umMachine,
        crossingMachine,
        umStats,
        crossingStats,
        active
      };
    }
    function spinHeadForTable(tableId) {
      const h = histories[tableId] ?? [];
      return h.length === 0 ? "0" : `${h.length}:${h[0]}`;
    }
    function anchorLiveSpinClockForFormation(tableId) {
      const head = spinHeadForTable(tableId);
      if (lastAnchoredHeadByTable[tableId] === head) return;
      lastAnchoredHeadByTable[tableId] = head;
      lastLiveSpinAtByTable[tableId] = Date.now();
    }
    function ingestHistorySnapshot(tableId, spins) {
      if (!ids.includes(tableId)) return null;
      histories[tableId] = spins.map((s) => s.number);
      if (spins[0]) {
        lastGameIdByTable[tableId] = `${tableId}::${spins[0].gameId}`;
        spinBaselinedByTable[tableId] = true;
      }
      const result = runTick();
      if (umMachine.pendingByTable[String(tableId)]) {
        anchorLiveSpinClockForFormation(tableId);
      }
      return result;
    }
    function canPlaceBet(tableId, nowMs = Date.now()) {
      const at = lastLiveSpinAtByTable[tableId];
      if (!at) return false;
      return nowMs - at >= EXTENSION_PRE_BET_WAIT_SEC * 1e3;
    }
    function ingestSpin(tableId, number, gameId, replay = false) {
      if (!ids.includes(tableId)) return null;
      const prefixed = `${tableId}::${gameId}`;
      if (!spinBaselinedByTable[tableId]) {
        lastGameIdByTable[tableId] = prefixed;
        spinBaselinedByTable[tableId] = true;
        if (!replay) return null;
      }
      if (lastGameIdByTable[tableId] === prefixed) return null;
      lastGameIdByTable[tableId] = prefixed;
      anchorLiveSpinClockForFormation(tableId);
      const h = histories[tableId] ?? [];
      h.unshift(number);
      if (h.length > 40) h.length = 40;
      histories[tableId] = h;
      return runTick();
    }
    function buildBridgePayload(result, mesaEmbedUrl = null) {
      const { active } = result;
      if (!active.showTapeteSignal || active.currentTableId == null) return null;
      if (!canPlaceBet(active.currentTableId)) return null;
      const tableId = active.currentTableId;
      const recovery = active.currentRecovery;
      const mesaProvider = typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/playtech") ? "playtech" : typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/pragmatic") ? "pragmatic" : "outro";
      if (active.trigger === "crossing" && active.activeCrossing) {
        const crossing = active.activeCrossing;
        const f1Label = doisFatoresFactorLabel(crossing.factor1);
        const f2Label = doisFatoresFactorLabel(crossing.factor2);
        const f1Key = pragmaticExteriorBetKeyFromFactor(crossing.factor1);
        const f2Key = pragmaticExteriorBetKeyFromFactor(crossing.factor2);
        const signalId2 = active.betAttemptKey ?? `${tableId}:${crossing.pairKind}:${recovery}`;
        const stakeAmount2 = stakeForRecovery(recovery, crossingMaxRecovery);
        return {
          type: "game-odds-glow/rotating-room-extension",
          version: 1,
          fingerprint: signalId2,
          actions: [
            {
              kind: "click",
              target: "factor-1",
              label: f1Label,
              reason: `Autopilot 2F \xB7 ${f1Label} \xB7 gale ${recovery}`
            },
            {
              kind: "click",
              target: "factor-2",
              label: f2Label,
              reason: `Autopilot 2F \xB7 ${f2Label} \xB7 gale ${recovery}`
            }
          ],
          context: {
            sessionMode: active.sessionMode,
            prepareTableId: null,
            currentTableId: tableId,
            mesaEmbedUrl,
            mesaProvider,
            factor1Label: f1Label,
            factor2Label: f2Label,
            factor1BetKey: f1Key,
            factor2BetKey: f2Key,
            singleFactorMode: false,
            rotativaTrigger: "crossing",
            strategy: "dois2fatores",
            signalId: signalId2,
            betAttemptKey: active.betAttemptKey,
            stakeAmount: stakeAmount2,
            currentRecovery: recovery,
            baseStake: BASE_STAKE,
            maxRecovery: crossingMaxRecovery,
            executionMode: null,
            mesaCatalog: []
          }
        };
      }
      const umActive = active.umActive;
      if (!umActive) return null;
      const label = umFatorAlertLabel(umActive);
      const betKey = pragmaticExteriorBetKeyFromFactor(umActive.alertFactor);
      const signalId = active.betAttemptKey ?? `${tableId}:${umActive.resultNumber}:${umActive.alertFactor.kind}:${recovery}`;
      const stakeAmount = stakeForRecovery(recovery, maxRecovery);
      return {
        type: "game-odds-glow/rotating-room-extension",
        version: 1,
        fingerprint: signalId,
        actions: [
          {
            kind: "click",
            target: "factor-1",
            label,
            reason: `Autopilot 1F \xB7 ${label} \xB7 gale ${recovery}`
          }
        ],
        context: {
          sessionMode: "active",
          prepareTableId: null,
          currentTableId: tableId,
          mesaEmbedUrl,
          mesaProvider,
          factor1Label: label,
          factor2Label: null,
          factor1BetKey: betKey,
          factor2BetKey: null,
          singleFactorMode: true,
          rotativaTrigger: "umFator",
          strategy: "um1fator",
          signalId,
          betAttemptKey: active.betAttemptKey,
          stakeAmount,
          currentRecovery: recovery,
          baseStake: BASE_STAKE,
          maxRecovery,
          executionMode: null,
          mesaCatalog: []
        }
      };
    }
    return {
      tableIds: ids,
      crossingEnabled,
      ingestHistorySnapshot,
      ingestSpin,
      runTick,
      buildBridgePayload,
      canPlaceBet,
      getState: () => ({
        machine: umMachine,
        stats: umStats,
        crossingMachine,
        crossingStats,
        histories,
        lastLiveSpinAtByTable,
        maxRecovery,
        crossingMaxRecovery
      }),
      resetStats() {
        umStats = emptyRotatingRoomSessionStats(maxRecovery);
        crossingStats = emptyRotatingRoomSessionStats(crossingMaxRecovery);
      },
      reset() {
        umMachine = sanitizeUmFatorMachineForTableIds(defaultUmFatorMachineState(), ids);
        crossingMachine = sanitizeRotatingRoomCrossingMachineForTableIds(
          defaultRotatingRoomCrossingMachineState(),
          ids
        );
        umStats = emptyRotatingRoomSessionStats(maxRecovery);
        crossingStats = emptyRotatingRoomSessionStats(crossingMaxRecovery);
        for (const id of ids) {
          histories[id] = [];
          delete lastGameIdByTable[id];
          delete spinBaselinedByTable[id];
          delete lastLiveSpinAtByTable[id];
          delete lastAnchoredHeadByTable[id];
        }
      }
    };
  }
  var createUmFatorEngine = createRotativaEngine;
  var api = {
    ROTATING_ROOM_TABLE_IDS,
    UM_FATOR_MAX_RECOVERY,
    EXTENSION_MAX_GALES,
    BASE_STAKE,
    EXTENSION_PRE_BET_WAIT_SEC,
    createRotativaEngine,
    createUmFatorEngine,
    clampExtensionMaxRecovery,
    doisFatoresFactorLabel
  };
  if (typeof globalThis !== "undefined") {
    globalThis.SinglestakeUmFator = api;
  }
  var strategy_entry_default = api;
  return __toCommonJS(strategy_entry_exports);
})();
