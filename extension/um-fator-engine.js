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
  function factorWins(num, factor) {
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
    return triple.filter((f) => factorWins(b, f));
  }
  function umFatorMatchCountOnTriple(num, triple) {
    if (num === 0) return 0;
    return triple.filter((f) => factorWins(num, f)).length;
  }
  function umFatorMatchCountWithReference(num, ref) {
    if (num === 0 || ref === 0) return 0;
    const triple = umFatorTripleFactorsForNumber(ref);
    if (!triple) return 0;
    return triple.filter((f) => factorWins(num, f)).length;
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
    const alertFactor = trigger.find((f) => !factorWins(n0, f));
    if (!alertFactor) return null;
    return buildUmFatorActive(n0, n1, n2, trigger, trigger, alertFactor, "three");
  }
  function detectUmFatorTwoTierActive(n0, n1, n2) {
    if (umFatorTriggerMatchCount(n1, n2) !== 2) return null;
    const trigger = umFatorTripleFactorsForNumber(n1);
    if (!trigger) return null;
    const shared = umFatorSharedFactorsBetween(n1, n2);
    if (shared.length !== 2) return null;
    const matchOnShared = shared.filter((f) => factorWins(n0, f)).length;
    if (matchOnShared !== 1) return null;
    if (umFatorMatchCountWithReference(n0, n1) !== 1) return null;
    const missingOnT0 = shared.find((f) => !factorWins(n0, f));
    if (!missingOnT0) return null;
    const alertFactor = oppositeFactor(missingOnT0);
    return buildUmFatorActive(n0, n1, n2, trigger, shared, alertFactor, "two");
  }
  function detectUmFatorActiveFromHistory(historyNewestFirst) {
    if (historyNewestFirst.length < UM_FATOR_MIN_HISTORY) return null;
    const n0 = historyNewestFirst[0];
    const n1 = historyNewestFirst[1];
    const n2 = historyNewestFirst[2];
    if (n0 === 0 || n1 === 0 || n2 === 0) return null;
    return detectUmFatorThreeTierActive(n0, n1, n2) ?? detectUmFatorTwoTierActive(n0, n1, n2);
  }
  function evaluateUmFatorRound(num, active) {
    if (num === 0) return "L";
    return factorWins(num, active.alertFactor) ? "W" : "L";
  }
  function umFatorAlertLabel(active) {
    return doisFatoresFactorLabel(active.alertFactor);
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
      postResultHoldTableId: null
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
      } else if (!isResultAlreadySettled(machine, tableId, head) && !isStaleQueuedFormation(machine, tableId, head) && !isBlockedByLobbyArmingGate(machine, tableId, head) && detectUmFatorActiveFromHistory(history) != null && tableArmableForUmFatorFormation(tableId, history)) {
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
      const formation = lockedTable != null ? null : h.length >= 3 && !active && !isStaleQueuedFormation(machine, tableId, spinHead(h)) ? detectUmFatorActiveFromHistory(h) : null;
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
      return !isStaleQueuedFormation(nextMachine, tableId, head) && detectUmFatorActiveFromHistory(history) != null && tableArmableForUmFatorFormation(tableId, history);
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
            flash = { resultNumber, won: false, tableId, kind: "recovery" };
          }
        }
        break;
      }
      if (pending) continue;
      if (isResultAlreadySettled(nextMachine, tableId, head)) continue;
      if (anyTablePendingEntryOpen(nextMachine, tableIds, histories)) continue;
      if (lobbyCooldownActive) continue;
      const formation = detectUmFatorActiveFromHistory(history);
      if (!formation) continue;
      if (shouldSkipTableForFormation(nextMachine, tableId, formation)) continue;
      if (isStaleQueuedFormation(nextMachine, tableId, head)) continue;
      if (isBlockedByLobbyArmingGate(nextMachine, tableId, head)) continue;
      if (!headChanged) continue;
      if (!tableAcceptableForRotatingRoomEntry(tableId, history)) continue;
      if (!tableArmableForUmFatorFormation(tableId, history)) continue;
      nextMachine = {
        ...nextMachine,
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

  // extension/strategy-entry.ts
  var ROTATING_ROOM_TABLE_IDS = buildRotatingRoomTableIds(206);
  var BASE_STAKE = 0.5;
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
  function createUmFatorEngine(tableIdsOrOptions = ROTATING_ROOM_TABLE_IDS) {
    const opts = Array.isArray(tableIdsOrOptions) ? { tableIds: tableIdsOrOptions } : tableIdsOrOptions;
    const ids = [...opts.tableIds ?? ROTATING_ROOM_TABLE_IDS];
    const maxRecovery = clampExtensionMaxRecovery(opts.maxRecovery);
    let machine = sanitizeUmFatorMachineForTableIds(defaultUmFatorMachineState(), ids);
    let stats = opts.initialStats != null ? parseRotatingRoomSessionStats(opts.initialStats, maxRecovery) : emptyRotatingRoomSessionStats(maxRecovery);
    const histories = {};
    const lastGameIdByTable = {};
    const spinBaselinedByTable = {};
    const lastLiveSpinAtByTable = {};
    const lastAnchoredHeadByTable = {};
    for (const id of ids) histories[id] = [];
    function expireExtensionStalePending() {
      const now = Date.now();
      const maxAgeMs = (EXTENSION_PRE_BET_WAIT_SEC + LIVE_TABLE_BETTING_WINDOW_SEC) * 1e3;
      const pendingByTable = { ...machine.pendingByTable };
      let changed = false;
      for (const tableId of ids) {
        if (!pendingByTable[String(tableId)]) continue;
        const at = lastLiveSpinAtByTable[tableId];
        if (at != null && now - at < maxAgeMs) continue;
        delete pendingByTable[String(tableId)];
        changed = true;
      }
      if (!changed) return;
      machine = {
        ...machine,
        pendingByTable,
        focusLockTableId: null
      };
    }
    function runTick() {
      expireExtensionStalePending();
      const tick = tickUmFatorPlacar(ids, histories, machine, stats, maxRecovery);
      machine = tick.nextMachine;
      stats = tick.stats;
      const view = buildUmFatorLiveView(ids, histories, machine);
      return { view, machine, stats, flash: tick.flash };
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
      if (result.machine.pendingByTable[String(tableId)]) {
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
      const { view, machine: machine2 } = result;
      if (!view.globalActive || view.globalTableId == null) return null;
      if (!canPlaceBet(view.globalTableId)) return null;
      const active = view.globalActive;
      const tableId = view.globalTableId;
      const recovery = machine2.recovery;
      const signalId = `${tableId}:${active.resultNumber}:${active.alertFactor.kind}:${recovery}`;
      const betKey = pragmaticExteriorBetKeyFromFactor(active.alertFactor);
      const label = umFatorAlertLabel(active);
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
            reason: `Autopilot \xB7 ${label} \xB7 gale ${recovery}`
          }
        ],
        context: {
          sessionMode: "active",
          prepareTableId: null,
          currentTableId: tableId,
          mesaEmbedUrl,
          mesaProvider: typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/playtech") ? "playtech" : typeof mesaEmbedUrl === "string" && mesaEmbedUrl.includes("/play/pragmatic") ? "pragmatic" : "outro",
          factor1Label: label,
          factor2Label: null,
          factor1BetKey: betKey,
          factor2BetKey: null,
          singleFactorMode: true,
          signalId,
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
      ingestHistorySnapshot,
      ingestSpin,
      runTick,
      buildBridgePayload,
      canPlaceBet,
      getState: () => ({ machine, stats, histories, lastLiveSpinAtByTable, maxRecovery }),
      resetStats() {
        stats = emptyRotatingRoomSessionStats(maxRecovery);
      },
      reset() {
        machine = sanitizeUmFatorMachineForTableIds(defaultUmFatorMachineState(), ids);
        stats = emptyRotatingRoomSessionStats(maxRecovery);
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
  var api = {
    ROTATING_ROOM_TABLE_IDS,
    UM_FATOR_MAX_RECOVERY,
    EXTENSION_MAX_GALES,
    BASE_STAKE,
    EXTENSION_PRE_BET_WAIT_SEC,
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
