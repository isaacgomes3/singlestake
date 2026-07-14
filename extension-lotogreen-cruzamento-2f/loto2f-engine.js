"use strict";
var SinglestakeLoto2f = (() => {
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

  // extension-lotogreen-cruzamento-2f/loto2f-strategy-entry.ts
  var loto2f_strategy_entry_exports = {};
  __export(loto2f_strategy_entry_exports, {
    LOTO2F_MAX_GALES: () => LOTO2F_MAX_GALES,
    LOTO2F_MESA_URL: () => LOTO2F_MESA_URL,
    LOTO2F_TABLE_ID: () => LOTO2F_TABLE_ID,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS: () => ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS: () => ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    createLoto2fEngine: () => createLoto2fEngine,
    default: () => loto2f_strategy_entry_default
  });

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

  // src/lib/roulette/doisFatoresPatternCrossing.ts
  function pairKindFromCrossingAxis(axis) {
    return axis;
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

  // src/lib/roulette/umFatorStrategy.ts
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
  function umFatorSharedFactorsBetween(a, b) {
    if (a === 0 || b === 0) return [];
    const triple = umFatorTripleFactorsForNumber(a);
    if (!triple) return [];
    return triple.filter((f) => factorWins2(b, f));
  }

  // src/lib/roulette/entryWinBreakdown.ts
  function emptyRecoveryLevelCounts(maxRecovery) {
    return Array.from({ length: maxRecovery + 1 }, () => 0);
  }
  function parseFibonacciZoneKindStats(raw) {
    const o = raw ?? {};
    return {
      dozen: parseUmFatorMatchTierBucket(o.dozen),
      column: parseUmFatorMatchTierBucket(o.column)
    };
  }
  function parseCrossingPatternKindStats(raw) {
    const o = raw ?? {};
    return {
      primary: parseUmFatorMatchTierBucket(o.primary),
      secondary: parseUmFatorMatchTierBucket(o.secondary),
      tertiary: parseUmFatorMatchTierBucket(o.tertiary)
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
  function parseRecoveryLevelCounts(raw, maxRecovery) {
    const base = emptyRecoveryLevelCounts(maxRecovery);
    if (!Array.isArray(raw)) return base;
    for (let i = 0; i <= maxRecovery; i++) {
      const n = Number(raw[i]);
      if (Number.isFinite(n) && n >= 0) base[i] = n;
    }
    return base;
  }
  function parsePairIndicationStats(raw) {
    if (!raw || typeof raw !== "object") return void 0;
    const out = {};
    for (const [id, slot] of Object.entries(raw)) {
      if (!id || !slot || typeof slot !== "object") continue;
      const o = slot;
      out[id] = {
        wins: Math.max(0, Number(o.wins) || 0),
        losses: Math.max(0, Number(o.losses) || 0)
      };
    }
    return Object.keys(out).length > 0 ? out : void 0;
  }
  function parseOutcomeHistory(raw) {
    if (!Array.isArray(raw)) return void 0;
    const out = [];
    for (const item of raw) {
      if (item === "W" || item === "L") out.push(item);
    }
    return out.length > 0 ? out.slice(-200) : void 0;
  }
  function parseRotatingRoomSessionStats(raw, maxRecovery = 5) {
    const o = raw ?? {};
    const pairIndication = parsePairIndicationStats(o.pairIndication);
    const outcomeHistory = parseOutcomeHistory(o.outcomeHistory);
    const indicationOutcomeHistory = parseOutcomeHistory(o.indicationOutcomeHistory);
    const base = {
      wins: Number(o.wins) || 0,
      losses: Number(o.losses) || 0,
      winsAtRecovery: parseRecoveryLevelCounts(o.winsAtRecovery, maxRecovery),
      lossesAtRecovery: parseRecoveryLevelCounts(o.lossesAtRecovery, maxRecovery),
      ...pairIndication ? { pairIndication } : {},
      ...outcomeHistory ? { outcomeHistory } : {},
      ...indicationOutcomeHistory ? { indicationOutcomeHistory } : {}
    };
    const withUm = o.umFatorMatchTier != null ? { ...base, umFatorMatchTier: parseUmFatorMatchTierStats(o.umFatorMatchTier) } : base;
    if (o.crossingPatternKind != null) {
      return {
        ...withUm,
        crossingPatternKind: parseCrossingPatternKindStats(o.crossingPatternKind),
        ...o.fibonacciZoneKind != null ? { fibonacciZoneKind: parseFibonacciZoneKindStats(o.fibonacciZoneKind) } : {}
      };
    }
    if (o.fibonacciZoneKind != null) {
      return {
        ...withUm,
        fibonacciZoneKind: parseFibonacciZoneKindStats(o.fibonacciZoneKind)
      };
    }
    return withUm;
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

  // src/lib/roulette/iceCruzamento2fStrategy.ts
  function pairKey(posA, posB) {
    return `${posA}x${posB}`;
  }
  function normalizePair(posA, posB, requiredFailures = 0) {
    const a = Math.max(1, Math.floor(posA));
    const b = Math.max(1, Math.floor(posB));
    return {
      id: pairKey(a, b),
      positions: [a, b],
      requiredFailures: Math.max(0, Math.floor(requiredFailures))
    };
  }
  var ICE_2F_DEFAULT_COMPARE_PAIRS = [
    normalizePair(3, 6, 0),
    normalizePair(2, 4, 0)
  ];
  var ice2fCompareConfig = {
    pairs: ICE_2F_DEFAULT_COMPARE_PAIRS.map((p) => ({ ...p, positions: [...p.positions] }))
  };
  function getIce2fComparePairs() {
    return ice2fCompareConfig.pairs;
  }
  function getIce2fComparePositions() {
    const first = ice2fCompareConfig.pairs[0];
    return first?.positions ?? [3, 6];
  }
  function getIce2fMinHistory() {
    let max = 1;
    for (const pair of ice2fCompareConfig.pairs) {
      max = Math.max(max, pair.positions[0], pair.positions[1]);
    }
    return max;
  }
  function getIce2fSoftMinHistory() {
    let min = Number.POSITIVE_INFINITY;
    for (const pair of ice2fCompareConfig.pairs) {
      min = Math.min(min, Math.max(pair.positions[0], pair.positions[1]));
    }
    return Number.isFinite(min) ? min : 1;
  }
  function pairDepth(pair) {
    return Math.max(pair.positions[0], pair.positions[1]);
  }
  var ICE_2F_COMPARE_POSITIONS = getIce2fComparePositions();
  var ICE_2F_CRITICAL_POSITIONS = getIce2fComparePositions();
  var ICE_2F_MIN_HISTORY = getIce2fMinHistory();
  var ICE_2F_MAX_RECOVERY = 5;
  function syncDeprecatedPositionExports() {
    ICE_2F_COMPARE_POSITIONS = getIce2fComparePositions();
    ICE_2F_CRITICAL_POSITIONS = getIce2fComparePositions();
    ICE_2F_MIN_HISTORY = getIce2fMinHistory();
  }
  function configureIce2fComparePairs(pairs) {
    const next = [];
    for (const raw of pairs) {
      const [a, b] = raw.positions;
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      next.push(normalizePair(a, b, raw.requiredFailures ?? 0));
    }
    ice2fCompareConfig.pairs = next.length > 0 ? next : ICE_2F_DEFAULT_COMPARE_PAIRS.map((p) => ({
      ...p,
      positions: [...p.positions]
    }));
    syncDeprecatedPositionExports();
  }
  function configureIce2fDefaultComparePairs() {
    configureIce2fComparePairs(ICE_2F_DEFAULT_COMPARE_PAIRS);
  }
  var ICE_2F_REQUIRED_FAILURES = 0;
  var ICE_2F_RECOVERY_BET_DELAY_MS = 6e3;
  var ICE_2F_IMMEDIATE_REBET_DELAY_MS = 800;
  var ICE_2F_FIRST_BET_SETTLE_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
  var ICE_2F_BET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
  var ICE_2F_STAKE_UNITS = [1, 2, 4, 8, 16, 32];
  function ice2fPadFactorPlacementMs(_units) {
    return 0;
  }
  function emptyWatchSlot() {
    return { failures: 0 };
  }
  function emptyWatch() {
    const w = {};
    for (const pair of getIce2fComparePairs()) w[pair.id] = emptyWatchSlot();
    return w;
  }
  function cloneWatch(watch) {
    const next = emptyWatch();
    for (const pair of getIce2fComparePairs()) {
      const raw = watch[pair.id];
      if (raw && typeof raw.failures === "number" && Number.isFinite(raw.failures)) {
        next[pair.id] = { failures: Math.max(0, Math.floor(raw.failures)) };
      }
    }
    return next;
  }
  function defaultIce2fMachineState() {
    const firstPair = getIce2fComparePairs()[0];
    return {
      cycle: null,
      watch: emptyWatch(),
      pendingArm: null,
      lastSpinHead: null,
      betCommitInFlight: false,
      betCommitArmedHead: null,
      inactiveSpinsWithoutEntry: 0,
      nextEntryAxis: "cor-altura",
      lockedPosition: null,
      pendingRecovery: 0,
      gatePairId: firstPair?.id ?? null,
      forceImmediateBet: false,
      pendingMatchObservations: {},
      pendingMatchObservation: null,
      zeroDebtUnits: 0,
      zeroRecoveredUnits: 0,
      zeroShift: 0,
      zeroRecoveryArmed: false
    };
  }
  function emptyPendingObservations() {
    return {};
  }
  function clonePendingObservations(raw, legacy) {
    const next = emptyPendingObservations();
    if (raw && typeof raw === "object") {
      for (const [id, obs] of Object.entries(raw)) {
        if (obs?.hit && typeof obs.observationHead === "string") {
          next[id] = { hit: obs.hit, observationHead: obs.observationHead };
        }
      }
    }
    if (legacy?.pairId && legacy.hit) {
      next[legacy.pairId] = {
        hit: legacy.hit,
        observationHead: legacy.observationHead
      };
    }
    return next;
  }
  function getPairConfigById(pairId) {
    return getIce2fComparePairs().find((p) => p.id === pairId);
  }
  function recordPairIndicationFailure(watch, pairId) {
    const next = cloneWatch(watch);
    const prev = next[pairId]?.failures ?? 0;
    next[pairId] = { failures: prev + 1 };
    return next;
  }
  function clearPairFailures(watch, pairId) {
    const next = cloneWatch(watch);
    next[pairId] = { failures: 0 };
    return next;
  }
  function resolvePendingMatchObservations(machine, resultNumber) {
    const pending = clonePendingObservations(
      machine.pendingMatchObservations,
      machine.pendingMatchObservation
    );
    const ids = Object.keys(pending);
    if (ids.length === 0) {
      return {
        ...machine,
        pendingMatchObservations: {},
        pendingMatchObservation: null
      };
    }
    let watch = machine.watch ?? emptyWatch();
    for (const pairId of ids) {
      const obs = pending[pairId];
      const active = ice2fBuildActiveFromHit(obs.hit);
      const outcome = ice2fClassifyBetRound(resultNumber, active);
      if (outcome === "W") {
        watch = clearPairFailures(watch, pairId);
      } else if (outcome === "L") {
        watch = recordPairIndicationFailure(watch, pairId);
      }
    }
    return {
      ...machine,
      watch,
      pendingMatchObservations: {},
      pendingMatchObservation: null
    };
  }
  function applyPairIndicationOutcome(machine, pairId, outcome) {
    if (!pairId) return machine;
    const pair = getPairConfigById(pairId);
    if (!pair || pair.requiredFailures <= 0) return machine;
    if (outcome === "continue") {
      return machine;
    }
    let watch = machine.watch ?? emptyWatch();
    if (outcome === "W") {
      watch = clearPairFailures(watch, pairId);
    } else {
      watch = recordPairIndicationFailure(watch, pairId);
    }
    return { ...machine, watch };
  }
  function spinHead(history) {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }
  function axisLabelPt(axis) {
    if (axis === "cor-altura") return "cor/altura";
    if (axis === "altura-paridade") return "paridade/altura";
    return "cor/paridade";
  }
  function axisShort(axis) {
    if (axis === "cor-altura") return "c/a";
    if (axis === "altura-paridade") return "p/a";
    return "c/p";
  }
  function pairKindFromFactors(f1, f2) {
    const kinds = /* @__PURE__ */ new Set([f1.kind, f2.kind]);
    if (kinds.has("cor") && kinds.has("altura")) return "cor-altura";
    if (kinds.has("cor") && kinds.has("paridade")) return "cor-paridade";
    return "altura-paridade";
  }
  function ice2fToggleAxis(axis) {
    if (axis === "cor-altura") return "altura-paridade";
    if (axis === "altura-paridade") return "cor-paridade";
    return "cor-altura";
  }
  function ice2fFindHitForPair(historyNewestFirst, posA, posB, pairMeta) {
    const depth = Math.max(posA, posB);
    if (historyNewestFirst.length < depth) return null;
    const numberA = historyNewestFirst[posA - 1];
    const numberB = historyNewestFirst[posB - 1];
    if (!Number.isFinite(numberA) || !Number.isFinite(numberB)) return null;
    if (numberA === 0 || numberB === 0) return null;
    const sharedCount = umFatorTriggerMatchCount(numberA, numberB);
    if (sharedCount < 2) return null;
    let axis;
    let factor1;
    let factor2;
    if (sharedCount >= 3) {
      axis = "cor-paridade";
      const factors = factorsForNumberOnAxis(numberA, axis);
      if (!factors) return null;
      factor1 = factors[0];
      factor2 = factors[1];
    } else {
      const shared = umFatorSharedFactorsBetween(numberA, numberB);
      if (shared.length !== 2) return null;
      factor1 = shared[0];
      factor2 = shared[1];
      axis = pairKindFromFactors(factor1, factor2);
    }
    return {
      criticalPosition: posA,
      matchPosition: posB,
      matchNumber: numberB,
      triggerNumber: numberA,
      axis,
      factor1,
      factor2,
      sharedCount: sharedCount >= 3 ? 3 : 2,
      pairId: pairMeta?.id ?? pairKey(posA, posB),
      requiredFailures: pairMeta?.requiredFailures ?? 0
    };
  }
  function toTapeteActive(active) {
    return {
      pairKind: active.pairKind,
      pairKindLabel: active.axis,
      patternMode: "convergence",
      patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
      referenceNumber: active.referenceNumber,
      factor1: active.factor1,
      factor2: active.factor2,
      triggerNumbers: [
        active.referenceNumber,
        active.matchNumber ?? active.referenceNumber
      ],
      armingDescription: active.armingDescription
    };
  }
  function ice2fClassifyBetRound(result, active) {
    if (result === 0) return "L";
    return evaluateDoisFatoresRound(result, toTapeteActive(active));
  }
  function ice2fBuildActiveFromHit(hit) {
    const labels = [hit.factor1, hit.factor2].map((f) => doisFatoresFactorLabel(f)).join(" \xB7 ");
    const tripleHint = hit.sharedCount === 3 ? " \xB7 3F\u2192cor/paridade" : "";
    const failHint = hit.requiredFailures > 0 ? ` \xB7 ap\xF3s ${hit.requiredFailures} falhas de indica\xE7\xE3o` : "";
    const posLabel = `pos${hit.criticalPosition}/${hit.matchPosition}`;
    return {
      criticalPosition: hit.criticalPosition,
      axis: hit.axis,
      factor1: hit.factor1,
      factor2: hit.factor2,
      pairKind: pairKindFromCrossingAxis(hit.axis),
      referenceNumber: hit.triggerNumber,
      armingDescription: `2F ${posLabel} ${axisLabelPt(hit.axis)}: n\xBA${hit.triggerNumber}\xB7${hit.matchNumber} \u2192 ${labels}${tripleHint}${failHint}`,
      matchPosition: hit.matchPosition,
      matchNumber: hit.matchNumber,
      triggerNumber: hit.triggerNumber,
      pairId: hit.pairId
    };
  }
  function primeIce2fWatchFromHistory(historyNewestFirst) {
    let watch = emptyWatch();
    const softMin = getIce2fSoftMinHistory();
    if (historyNewestFirst.length < softMin) return watch;
    const chronological = [...historyNewestFirst].reverse();
    const pendingByPair = /* @__PURE__ */ new Map();
    for (let end = softMin; end <= chronological.length; end++) {
      const sliceNewestFirst = chronological.slice(0, end).reverse();
      const resultNumber = chronological[end - 1];
      for (const pair of getIce2fComparePairs()) {
        if (sliceNewestFirst.length < pairDepth(pair)) continue;
        const pending = pendingByPair.get(pair.id);
        if (pending) {
          const active = ice2fBuildActiveFromHit(pending);
          const outcome = ice2fClassifyBetRound(resultNumber, active);
          if (outcome === "W") watch = clearPairFailures(watch, pair.id);
          else if (outcome === "L") watch = recordPairIndicationFailure(watch, pair.id);
          pendingByPair.delete(pair.id);
        }
        const failures = watch[pair.id]?.failures ?? 0;
        if (failures >= pair.requiredFailures && pair.requiredFailures > 0) continue;
        const hit = ice2fFindHitForPair(
          sliceNewestFirst,
          pair.positions[0],
          pair.positions[1],
          { id: pair.id, requiredFailures: pair.requiredFailures }
        );
        if (hit) pendingByPair.set(pair.id, hit);
      }
    }
    return watch;
  }
  function ice2fClearCycleKeepGale(machine, recoveryToKeep) {
    return {
      ...machine,
      cycle: null,
      betCommitInFlight: false,
      betCommitArmedHead: null,
      lockedPosition: null,
      pendingRecovery: Math.max(0, Math.floor(recoveryToKeep))
    };
  }
  function advanceGateAfterWinOrLoss(machine, fromPairId) {
    return {
      ...machine,
      gatePairId: fromPairId ?? machine.gatePairId ?? null,
      lockedPosition: null
    };
  }
  function insistGateAfterTie(machine, pairId, recoveryToKeep) {
    return {
      ...ice2fClearCycleKeepGale(machine, recoveryToKeep),
      gatePairId: pairId ?? machine.gatePairId ?? null
    };
  }
  function armCycleFromHit(machine, head, hit, recovery) {
    const active = ice2fBuildActiveFromHit(hit);
    const immediate = recovery > 0 || machine.forceImmediateBet === true;
    const pending = clonePendingObservations(
      machine.pendingMatchObservations,
      machine.pendingMatchObservation
    );
    delete pending[hit.pairId];
    return {
      ...machine,
      lockedPosition: hit.criticalPosition,
      nextEntryAxis: hit.axis,
      inactiveSpinsWithoutEntry: 0,
      pendingArm: null,
      pendingRecovery: 0,
      forceImmediateBet: false,
      gatePairId: hit.pairId,
      pendingMatchObservations: pending,
      pendingMatchObservation: null,
      cycle: {
        active,
        armedHead: head,
        recovery,
        phase: "awaiting_bet",
        immediateBet: immediate
      }
    };
  }
  function tryArmCycleFromWatch(machine, historyNewestFirst, head) {
    if (machine.cycle) return machine;
    if (historyNewestFirst.length < getIce2fSoftMinHistory()) return machine;
    const pendingRecovery = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
    const watch = machine.watch ?? emptyWatch();
    const pending = clonePendingObservations(
      machine.pendingMatchObservations,
      machine.pendingMatchObservation
    );
    let armHit = null;
    for (const pair of getIce2fComparePairs()) {
      if (historyNewestFirst.length < pairDepth(pair)) continue;
      const hit = ice2fFindHitForPair(
        historyNewestFirst,
        pair.positions[0],
        pair.positions[1],
        { id: pair.id, requiredFailures: pair.requiredFailures }
      );
      if (!hit) {
        delete pending[pair.id];
        continue;
      }
      const failures = watch[pair.id]?.failures ?? 0;
      if (pair.requiredFailures <= 0 || failures >= pair.requiredFailures) {
        if (!armHit) armHit = hit;
        delete pending[pair.id];
      } else {
        pending[pair.id] = { hit, observationHead: head };
      }
    }
    if (armHit) {
      return armCycleFromHit(
        {
          ...machine,
          watch,
          pendingMatchObservations: pending,
          pendingMatchObservation: null,
          betCommitInFlight: false
        },
        head,
        armHit,
        pendingRecovery
      );
    }
    return {
      ...machine,
      watch,
      pendingMatchObservations: pending,
      pendingMatchObservation: null,
      betCommitInFlight: false
    };
  }
  function armAfterLoss(machine, _historyNewestFirst, _head, nextRecovery, _previousAxis) {
    return {
      ...machine,
      lockedPosition: null,
      pendingRecovery: nextRecovery,
      cycle: null,
      betCommitInFlight: false
    };
  }
  function ice2fStakeUnits(recovery, zeroShift = 0) {
    const idx = Math.min(
      Math.max(0, Math.floor(recovery)),
      ICE_2F_STAKE_UNITS.length - 1
    );
    const shift = Math.max(0, Math.floor(zeroShift));
    return ICE_2F_STAKE_UNITS[idx] * 2 ** shift;
  }
  function ice2fDoubleClicks(recovery, zeroShift = 0) {
    return Math.max(0, Math.floor(recovery)) + Math.max(0, Math.floor(zeroShift));
  }
  function ice2fEffectiveZeroShift(machine) {
    const debt = machine.zeroDebtUnits ?? 0;
    if (debt <= 0) return 0;
    if (!machine.zeroRecoveryArmed) return 0;
    return Math.max(0, Math.floor(machine.zeroShift ?? 0));
  }
  function clearZeroRecovery(machine) {
    return {
      ...machine,
      zeroDebtUnits: 0,
      zeroRecoveredUnits: 0,
      zeroShift: 0,
      zeroRecoveryArmed: false
    };
  }
  function applyWinZeroRecoveryAccounting(machine, wonUnits) {
    const debt = machine.zeroDebtUnits ?? 0;
    if (debt <= 0) return clearZeroRecovery(machine);
    if (!machine.zeroRecoveryArmed) {
      return {
        ...machine,
        zeroRecoveryArmed: true,
        zeroRecoveredUnits: 0
      };
    }
    const recovered = (machine.zeroRecoveredUnits ?? 0) + Math.max(0, wonUnits);
    if (recovered >= debt) return clearZeroRecovery(machine);
    return {
      ...machine,
      zeroRecoveredUnits: recovered,
      zeroRecoveryArmed: true
    };
  }
  function ice2fRecoveryAfterLoss(recovery) {
    return Math.max(0, Math.floor(recovery)) + 1;
  }
  function ice2fBetDelayMs(_recovery, immediateBet) {
    return immediateBet === true ? ICE_2F_IMMEDIATE_REBET_DELAY_MS : ICE_2F_RECOVERY_BET_DELAY_MS;
  }
  function ice2fBetDelayUntilMs(recovery, lastSpinAtMs, immediateBet) {
    const delayMs = ice2fBetDelayMs(recovery, immediateBet);
    return lastSpinAtMs != null && Number.isFinite(lastSpinAtMs) ? lastSpinAtMs + delayMs : null;
  }
  function canPlaceIce2fBet(recovery, lastSpinAtMs, nowMs = Date.now(), immediateBet) {
    if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
    return nowMs - lastSpinAtMs >= ice2fBetDelayMs(recovery, immediateBet);
  }
  function tickIce2fPlacar(historyNewestFirst, machine, stats, maxRecovery = ICE_2F_MAX_RECOVERY) {
    const head = spinHead(historyNewestFirst);
    const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
    let nextMachine = {
      ...machine,
      lastSpinHead: head,
      watch: cloneWatch(machine.watch ?? emptyWatch()),
      nextEntryAxis: machine.nextEntryAxis ?? "cor-altura",
      lockedPosition: machine.lockedPosition ?? null,
      pendingRecovery: machine.pendingRecovery ?? 0,
      pendingMatchObservations: clonePendingObservations(
        machine.pendingMatchObservations,
        machine.pendingMatchObservation
      ),
      pendingMatchObservation: null
    };
    let nextStats = stats;
    let statsChanged = false;
    let flash = null;
    let missedBetWindow = false;
    if (headChanged && Object.keys(nextMachine.pendingMatchObservations ?? {}).length > 0) {
      nextMachine = resolvePendingMatchObservations(
        nextMachine,
        historyNewestFirst[0]
      );
    }
    if (nextMachine.cycle?.phase === "awaiting_bet" && headChanged && nextMachine.cycle.armedHead !== head) {
      missedBetWindow = true;
      nextMachine = {
        ...ice2fClearCycleKeepGale(nextMachine, nextMachine.cycle.recovery),
        forceImmediateBet: true
      };
    }
    if (nextMachine.cycle?.phase === "awaiting_reference" && headChanged && nextMachine.cycle.armedHead !== head) {
      nextMachine = ice2fClearCycleKeepGale(nextMachine, nextMachine.cycle.recovery);
    }
    if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
      const cycle = nextMachine.cycle;
      const resultNumber = historyNewestFirst[0];
      const outcome = ice2fClassifyBetRound(resultNumber, cycle.active);
      const { active, recovery } = cycle;
      if (outcome === "W") {
        const wonUnits = ice2fStakeUnits(
          recovery,
          ice2fEffectiveZeroShift(nextMachine)
        );
        nextStats = recordRotatingRoomSessionWin(nextStats, recovery, maxRecovery);
        nextStats = recordIce2fPairIndication(nextStats, active.pairId, "win");
        nextStats = recordIce2fIndicationOutcome(nextStats, "W");
        nextStats = recordIce2fClosedOutcome(nextStats, "W");
        statsChanged = true;
        nextMachine = ice2fClearCycleKeepGale(
          applyWinZeroRecoveryAccounting(nextMachine, wonUnits),
          0
        );
        nextMachine = applyPairIndicationOutcome(nextMachine, active.pairId, "W");
        nextMachine = advanceGateAfterWinOrLoss(nextMachine, active.pairId);
        flash = {
          resultNumber,
          won: true,
          kind: "win",
          criticalPosition: active.criticalPosition,
          axis: active.axis,
          recovery,
          factor1: active.factor1,
          factor2: active.factor2
        };
      } else if (outcome === "continue") {
        nextMachine = insistGateAfterTie(nextMachine, active.pairId, recovery);
        flash = {
          resultNumber,
          won: false,
          kind: "tie",
          criticalPosition: active.criticalPosition,
          axis: active.axis,
          recovery,
          factor1: active.factor1,
          factor2: active.factor2
        };
      } else {
        const nextRecovery = ice2fRecoveryAfterLoss(recovery);
        if (nextRecovery > maxRecovery) {
          nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recovery, maxRecovery);
          nextStats = recordIce2fPairIndication(nextStats, active.pairId, "loss");
          nextStats = recordIce2fIndicationOutcome(nextStats, "L");
          nextStats = recordIce2fClosedOutcome(nextStats, "L");
          statsChanged = true;
          nextMachine = {
            ...ice2fClearCycleKeepGale(nextMachine, 0),
            nextEntryAxis: ice2fToggleAxis(active.axis)
          };
          nextMachine = applyPairIndicationOutcome(nextMachine, active.pairId, "L");
          nextMachine = advanceGateAfterWinOrLoss(nextMachine, active.pairId);
          flash = {
            resultNumber,
            won: false,
            kind: "loss",
            criticalPosition: active.criticalPosition,
            axis: active.axis,
            recovery,
            factor1: active.factor1,
            factor2: active.factor2
          };
        } else {
          nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recovery, maxRecovery);
          nextStats = recordIce2fPairIndication(nextStats, active.pairId, "loss");
          nextStats = recordIce2fIndicationOutcome(nextStats, "L");
          statsChanged = true;
          flash = {
            resultNumber,
            won: false,
            kind: "loss",
            criticalPosition: active.criticalPosition,
            axis: active.axis,
            recovery,
            factor1: active.factor1,
            factor2: active.factor2
          };
          nextMachine = armAfterLoss(
            nextMachine,
            historyNewestFirst,
            head,
            nextRecovery,
            active.axis
          );
          nextMachine = applyPairIndicationOutcome(nextMachine, active.pairId, "L");
          nextMachine = advanceGateAfterWinOrLoss(nextMachine, active.pairId);
        }
      }
    }
    if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= getIce2fSoftMinHistory()) {
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
    }
    if (!nextMachine.cycle && machine.lastSpinHead == null && historyNewestFirst.length >= getIce2fSoftMinHistory()) {
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
    }
    const globalActive = nextMachine.cycle?.phase === "awaiting_bet" || nextMachine.cycle?.phase === "awaiting_result" ? nextMachine.cycle.active : null;
    const globalRecovery = nextMachine.cycle?.recovery ?? Math.max(0, Math.floor(nextMachine.pendingRecovery ?? 0));
    return {
      machine: nextMachine,
      stats: nextStats,
      statsChanged,
      flash,
      globalActive,
      globalRecovery,
      missedBetWindow
    };
  }
  function emptyIce2fPairIndicationStats() {
    const out = {};
    for (const pair of getIce2fComparePairs()) {
      out[pair.id] = { wins: 0, losses: 0 };
    }
    return out;
  }
  function recordIce2fPairIndication(stats, pairId, kind) {
    if (!pairId) return stats;
    const prev = stats.pairIndication ?? emptyIce2fPairIndicationStats();
    const slot = prev[pairId] ?? { wins: 0, losses: 0 };
    const nextSlot = kind === "win" ? { wins: slot.wins + 1, losses: slot.losses } : { wins: slot.wins, losses: slot.losses + 1 };
    return {
      ...stats,
      pairIndication: { ...prev, [pairId]: nextSlot }
    };
  }
  var ICE_2F_OUTCOME_HISTORY_MAX = 200;
  function recordIce2fClosedOutcome(stats, kind) {
    const prev = Array.isArray(stats.outcomeHistory) ? stats.outcomeHistory : [];
    const next = [...prev, kind];
    if (next.length > ICE_2F_OUTCOME_HISTORY_MAX) {
      next.splice(0, next.length - ICE_2F_OUTCOME_HISTORY_MAX);
    }
    return { ...stats, outcomeHistory: next };
  }
  function recordIce2fIndicationOutcome(stats, kind) {
    const prev = Array.isArray(stats.indicationOutcomeHistory) ? stats.indicationOutcomeHistory : [];
    const next = [...prev, kind];
    if (next.length > ICE_2F_OUTCOME_HISTORY_MAX) {
      next.splice(0, next.length - ICE_2F_OUTCOME_HISTORY_MAX);
    }
    return { ...stats, indicationOutcomeHistory: next };
  }
  function buildIce2fStreakChartMetrics(stats) {
    const placarOutcomes = Array.isArray(stats?.outcomeHistory) ? stats.outcomeHistory.filter((x) => x === "W" || x === "L") : [];
    const triggerOutcomes = Array.isArray(stats?.indicationOutcomeHistory) ? stats.indicationOutcomeHistory.filter((x) => x === "W" || x === "L") : placarOutcomes;
    const winStreakSeries = [];
    let winStreak = 0;
    let maxWinStreak = 0;
    for (const o of placarOutcomes) {
      if (o === "W") {
        winStreak += 1;
        maxWinStreak = Math.max(maxWinStreak, winStreak);
      } else {
        winStreak = 0;
      }
      winStreakSeries.push(winStreak);
    }
    const lossStreakSeries = [];
    let lossStreak = 0;
    let maxLossStreak = 0;
    let triggerWins = 0;
    let triggerLosses = 0;
    for (const o of triggerOutcomes) {
      if (o === "L") {
        triggerLosses += 1;
        lossStreak += 1;
        maxLossStreak = Math.max(maxLossStreak, lossStreak);
      } else {
        triggerWins += 1;
        lossStreak = 0;
      }
      lossStreakSeries.push(-lossStreak);
    }
    let pairWins = 0;
    let pairLosses = 0;
    let hasPair = false;
    for (const slot of Object.values(stats?.pairIndication ?? {})) {
      if (!slot) continue;
      hasPair = true;
      pairWins += slot.wins ?? 0;
      pairLosses += slot.losses ?? 0;
    }
    if (hasPair) {
      triggerWins = pairWins;
      triggerLosses = pairLosses;
    }
    return {
      outcomes: placarOutcomes,
      winStreakSeries,
      lossStreakSeries,
      currentWinStreak: winStreak,
      currentLossStreak: lossStreak,
      maxWinStreak,
      maxLossStreak,
      totalWins: stats?.wins ?? placarOutcomes.filter((x) => x === "W").length,
      totalLosses: stats?.losses ?? placarOutcomes.filter((x) => x === "L").length,
      triggerWins,
      triggerLosses
    };
  }
  function parseIce2fStats(raw, maxRecovery = ICE_2F_MAX_RECOVERY) {
    const parsed = parseRotatingRoomSessionStats(raw, maxRecovery);
    const base = emptyIce2fPairIndicationStats();
    const rawPairs = parsed.pairIndication ?? {};
    for (const id of Object.keys(base)) {
      const slot = rawPairs[id];
      if (slot) base[id] = { wins: slot.wins, losses: slot.losses };
    }
    for (const [id, slot] of Object.entries(rawPairs)) {
      if (!(id in base) && slot) base[id] = { wins: slot.wins, losses: slot.losses };
    }
    const outcomeHistory = Array.isArray(parsed.outcomeHistory) ? parsed.outcomeHistory.filter((x) => x === "W" || x === "L").slice(-ICE_2F_OUTCOME_HISTORY_MAX) : [];
    const indicationOutcomeHistory = Array.isArray(parsed.indicationOutcomeHistory) ? parsed.indicationOutcomeHistory.filter((x) => x === "W" || x === "L").slice(-ICE_2F_OUTCOME_HISTORY_MAX) : [];
    return {
      ...parsed,
      pairIndication: base,
      outcomeHistory,
      indicationOutcomeHistory
    };
  }
  function emptyIce2fStats(maxRecovery = ICE_2F_MAX_RECOVERY) {
    return {
      ...emptyRotatingRoomSessionStats(maxRecovery),
      pairIndication: emptyIce2fPairIndicationStats(),
      outcomeHistory: [],
      indicationOutcomeHistory: []
    };
  }
  function formatIce2fWatchLabel(watch, _requiredFailures = ICE_2F_REQUIRED_FAILURES) {
    const parts = [];
    for (const pair of getIce2fComparePairs()) {
      const f = watch[pair.id]?.failures ?? 0;
      if (pair.requiredFailures <= 0) {
        parts.push(`${pair.positions[0]}\xD7${pair.positions[1]}`);
      } else {
        parts.push(
          `${pair.positions[0]}\xD7${pair.positions[1]}:${f}/${pair.requiredFailures}`
        );
      }
    }
    return parts.join(" \xB7 ") || "2F em comum";
  }
  function ice2fWatchLabelForMachine(machine) {
    const pending = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
    const cycle = machine.cycle?.active;
    if (cycle) {
      const pair = cycle.pairId ?? `pos${cycle.criticalPosition}/${cycle.matchPosition ?? "?"}`;
      return `${pair} ${axisShort(cycle.axis)} \xB7 gale ${machine.cycle?.recovery ?? 0}`;
    }
    const watchLabel = formatIce2fWatchLabel(machine.watch ?? emptyWatch());
    const obsCount = Object.keys(machine.pendingMatchObservations ?? {}).length;
    const obsHint = obsCount > 0 ? ` \xB7 obs ${obsCount}` : "";
    return pending > 0 ? `${watchLabel}${obsHint} \xB7 gale ${pending}` : `${watchLabel}${obsHint}`;
  }

  // extension-lotogreen-cruzamento-2f/loto2f-strategy-entry.ts
  configureIce2fDefaultComparePairs();
  var LOTO2F_TABLE_ID = 225;
  var LOTO2F_MESA_URL = "https://lotogreen.bet.br/play/pragmatic/auto-roulette";
  var LOTO2F_MAX_GALES = ICE_2F_MAX_RECOVERY;
  var ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_2F_FIRST_BET_SETTLE_MS;
  var ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
  var BASE_STAKE = 0.5;
  var LOTO2F_POSITIONS = new Set(
    getIce2fComparePairs().flatMap((p) => [...p.positions])
  );
  var LOTO2F_AXES = /* @__PURE__ */ new Set(["cor-altura", "altura-paridade", "cor-paridade"]);
  var LOTO2F_PAIR_IDS = new Set(getIce2fComparePairs().map((p) => p.id));
  function parsePersistedWatch(raw) {
    if (!raw || typeof raw !== "object") return null;
    const base = defaultIce2fMachineState().watch;
    for (const id of LOTO2F_PAIR_IDS) {
      const slot = raw[id];
      if (slot && typeof slot.failures === "number" && Number.isFinite(slot.failures)) {
        base[id] = { failures: Math.max(0, Math.floor(slot.failures)) };
      }
    }
    return base;
  }
  function clampMaxRecovery(value, fallback = ICE_2F_MAX_RECOVERY) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback));
    return Math.min(ICE_2F_MAX_RECOVERY, Math.max(0, Math.floor(n)));
  }
  function pendingRecoveryFromSaved(saved) {
    const stored = typeof saved.pendingRecovery === "number" && Number.isFinite(saved.pendingRecovery) ? Math.max(0, Math.floor(saved.pendingRecovery)) : 0;
    if (stored > 0) return stored;
    const recovery = typeof saved.recovery === "number" && Number.isFinite(saved.recovery) ? Math.max(0, Math.floor(saved.recovery)) : 0;
    if (saved.phase === "awaiting_bet" || saved.phase === "awaiting_result" || saved.phase === "awaiting_reference") {
      return recovery;
    }
    return 0;
  }
  function createLoto2fEngine(options = {}) {
    const maxRecovery = clampMaxRecovery(options.maxRecovery);
    let machine = defaultIce2fMachineState();
    if (options.initialMachine) {
      const saved = options.initialMachine;
      const restoredWatch = parsePersistedWatch(saved.watch);
      machine = {
        ...machine,
        lastSpinHead: saved.lastSpinHead ?? null,
        nextEntryAxis: saved.nextEntryAxis && LOTO2F_AXES.has(saved.nextEntryAxis) ? saved.nextEntryAxis : "cor-altura",
        lockedPosition: typeof saved.lockedPosition === "number" && LOTO2F_POSITIONS.has(saved.lockedPosition) ? saved.lockedPosition : null,
        pendingRecovery: typeof saved.pendingRecovery === "number" && Number.isFinite(saved.pendingRecovery) ? Math.max(0, Math.floor(saved.pendingRecovery)) : 0,
        gatePairId: typeof saved.gatePairId === "string" && LOTO2F_PAIR_IDS.has(saved.gatePairId) ? saved.gatePairId : machine.gatePairId,
        ...restoredWatch ? { watch: restoredWatch } : {}
      };
    }
    let pendingRestore = options.initialMachine ?? null;
    let stats = options.initialStats != null ? parseIce2fStats(options.initialStats, maxRecovery) : emptyIce2fStats(maxRecovery);
    let history = [];
    let lastGameId = null;
    let spinBaselined = false;
    let liveSpinSeen = false;
    let lastLiveSpinAt = null;
    function spinHead2() {
      if (history.length === 0) return "0";
      return `${history.length}:${history[0]}`;
    }
    function runTick() {
      const tick = tickIce2fPlacar(history, machine, stats, maxRecovery);
      machine = tick.machine;
      stats = tick.stats;
      return {
        active: tick.globalActive,
        recovery: tick.globalRecovery,
        machine: tick.machine,
        stats: tick.stats,
        flash: tick.flash,
        missedBetWindow: tick.missedBetWindow === true
      };
    }
    function anchorSpinClock() {
      lastLiveSpinAt = Date.now();
    }
    function ingestHistorySnapshot(spins) {
      if (liveSpinSeen) return null;
      history = spins.map((s) => s.number);
      if (spins[0]) {
        lastGameId = spins[0].gameId;
        spinBaselined = true;
      }
      const head = spinHead2();
      const watch = primeIce2fWatchFromHistory(history);
      const preservedCycle = machine.cycle;
      machine = {
        ...defaultIce2fMachineState(),
        watch,
        lastSpinHead: head
      };
      if (preservedCycle?.phase === "awaiting_result") {
        machine = {
          ...machine,
          lockedPosition: null,
          nextEntryAxis: preservedCycle.active.axis,
          pendingRecovery: 0,
          cycle: {
            ...preservedCycle,
            phase: "awaiting_result",
            armedHead: head
          }
        };
      } else if (pendingRestore) {
        const axis = (pendingRestore.nextEntryAxis && LOTO2F_AXES.has(pendingRestore.nextEntryAxis) ? pendingRestore.nextEntryAxis : null) ?? (pendingRestore.axis && LOTO2F_AXES.has(pendingRestore.axis) ? pendingRestore.axis : null) ?? "cor-altura";
        const locked = typeof pendingRestore.lockedPosition === "number" && LOTO2F_POSITIONS.has(pendingRestore.lockedPosition) ? pendingRestore.lockedPosition : null;
        const pendingRecovery = pendingRecoveryFromSaved(pendingRestore);
        const restoredWatch = parsePersistedWatch(pendingRestore.watch);
        const gatePairId = typeof pendingRestore.gatePairId === "string" && LOTO2F_PAIR_IDS.has(pendingRestore.gatePairId) ? pendingRestore.gatePairId : machine.gatePairId;
        pendingRestore = null;
        machine = {
          ...machine,
          nextEntryAxis: axis,
          lockedPosition: locked,
          pendingRecovery,
          gatePairId,
          // Preferir watch persistido (falhas) sobre só o prime do snapshot.
          watch: restoredWatch ?? machine.watch
        };
        if (history.length >= getIce2fSoftMinHistory()) {
          machine = tryArmCycleFromWatch(machine, history, head);
        }
      } else if (history.length >= getIce2fSoftMinHistory()) {
        machine = tryArmCycleFromWatch(machine, history, head);
      }
      lastLiveSpinAt = Date.now();
      const tick = tickIce2fPlacar(history, machine, stats, maxRecovery);
      machine = tick.machine;
      return {
        active: tick.globalActive,
        recovery: tick.globalRecovery,
        machine: tick.machine,
        stats: tick.stats,
        flash: tick.flash,
        missedBetWindow: tick.missedBetWindow === true
      };
    }
    function ingestSpin(number, gameId, replay = false) {
      if (!spinBaselined) {
        lastGameId = gameId;
        spinBaselined = true;
      }
      if (lastGameId === gameId && !replay) return null;
      lastGameId = gameId;
      liveSpinSeen = true;
      anchorSpinClock();
      history.unshift(number);
      if (history.length > 40) history.length = 40;
      return runTick();
    }
    function canPlaceBet(nowMs = Date.now()) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
      return canPlaceIce2fBet(machine.cycle.recovery, lastLiveSpinAt, nowMs, machine.cycle.immediateBet === true);
    }
    function beginBetCommit() {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
      machine = {
        ...machine,
        betCommitInFlight: true,
        betCommitArmedHead: machine.cycle.armedHead
      };
      return true;
    }
    function abortBetCommit() {
      if (!machine.betCommitInFlight && machine.betCommitArmedHead == null) return;
      machine = {
        ...machine,
        betCommitInFlight: false,
        betCommitArmedHead: null
      };
    }
    function markBetPlaced() {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") {
        machine = {
          ...machine,
          betCommitInFlight: false,
          betCommitArmedHead: null
        };
        return false;
      }
      if (machine.betCommitArmedHead != null && machine.cycle.armedHead !== machine.betCommitArmedHead) {
        machine = {
          ...machine,
          betCommitInFlight: false,
          betCommitArmedHead: null
        };
        return false;
      }
      machine = {
        ...machine,
        betCommitInFlight: false,
        betCommitArmedHead: null,
        cycle: { ...machine.cycle, phase: "awaiting_result", immediateBet: false }
      };
      return true;
    }
    function buildBridgePayload(mesaEmbedUrl = LOTO2F_MESA_URL) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
      if (!canPlaceBet()) return null;
      const { active, recovery } = machine.cycle;
      const zeroShift = ice2fEffectiveZeroShift(machine);
      const units = ice2fStakeUnits(recovery, zeroShift);
      const doubles = ice2fDoubleClicks(recovery, zeroShift);
      const signalId = `loto2f:pos${active.criticalPosition}:${active.axis}:ref${active.referenceNumber}:r${recovery}`;
      const f1Key = pragmaticExteriorBetKeyFromFactor(active.factor1);
      const f2Key = pragmaticExteriorBetKeyFromFactor(active.factor2);
      const f1Label = doisFatoresFactorLabel(active.factor1);
      const f2Label = doisFatoresFactorLabel(active.factor2);
      const stakeAmount = BASE_STAKE * units;
      const betDelayUntilMs = ice2fBetDelayUntilMs(recovery, lastLiveSpinAt, machine.cycle.immediateBet === true);
      const galeSuffix = recovery > 0 ? ` \xB7 gale ${recovery}` : " \xB7 entrada";
      const actions = [
        {
          kind: "click",
          target: "factor-1",
          label: f1Label,
          reason: `Lotogreen 2F \xB7 ${f1Label}${galeSuffix}`
        },
        {
          kind: "click",
          target: "factor-2",
          label: f2Label,
          reason: `Lotogreen 2F \xB7 ${f2Label}${galeSuffix}`
        }
      ];
      for (let i = 0; i < doubles; i++) {
        actions.push({
          kind: "click",
          target: "repeat-bet",
          label: "Dobrar",
          reason: `Lotogreen 2F \xB7 Dobrar ${i + 1}/${doubles}${galeSuffix}`
        });
      }
      return {
        type: "game-odds-glow/rotating-room-extension",
        version: 1,
        fingerprint: signalId,
        actions,
        context: {
          sessionMode: "active",
          prepareTableId: null,
          currentTableId: LOTO2F_TABLE_ID,
          mesaEmbedUrl: mesaEmbedUrl ?? LOTO2F_MESA_URL,
          mesaProvider: "outro",
          factor1Label: f1Label,
          factor2Label: f2Label,
          factor1BetKey: f1Key,
          factor2BetKey: f2Key,
          singleFactorMode: false,
          signalId,
          stakeAmount,
          units,
          chipClicks: 1,
          useDoubleGale: true,
          doubleClicks: doubles,
          currentRecovery: recovery,
          baseStake: BASE_STAKE,
          maxRecovery,
          executionMode: null,
          strategy: "loto2fcruzamento",
          rotativaTrigger: "critical",
          betDelayUntilMs,
          mesaCatalog: []
        }
      };
    }
    return {
      tableId: LOTO2F_TABLE_ID,
      ingestHistorySnapshot,
      ingestSpin,
      runTick,
      buildBridgePayload,
      canPlaceBet,
      beginBetCommit,
      abortBetCommit,
      markBetPlaced,
      getState: () => ({
        machine,
        stats,
        history,
        lastLiveSpinAt,
        maxRecovery
      }),
      resetStats() {
        stats = emptyIce2fStats(maxRecovery);
      },
      reset() {
        machine = defaultIce2fMachineState();
        stats = emptyIce2fStats(maxRecovery);
        history = [];
        lastGameId = null;
        spinBaselined = false;
        liveSpinSeen = false;
        lastLiveSpinAt = null;
        pendingRestore = null;
      }
    };
  }
  var api = {
    LOTO2F_TABLE_ID,
    LOTO2F_MESA_URL,
    LOTO2F_MAX_GALES,
    ICE_2F_BET_DELAY_MS,
    ICE_2F_FIRST_BET_SETTLE_MS,
    ICE_2F_IMMEDIATE_REBET_DELAY_MS,
    ICE_2F_MAX_RECOVERY,
    ICE_2F_RECOVERY_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    emptyIce2fStats,
    buildIce2fStreakChartMetrics,
    formatIce2fWatchLabel,
    ice2fWatchLabelForMachine,
    ice2fBetDelayMs,
    ice2fBetDelayUntilMs,
    ice2fPadFactorPlacementMs,
    ice2fDoubleClicks,
    ice2fEffectiveZeroShift,
    ice2fStakeUnits,
    createLoto2fEngine
  };
  if (typeof globalThis !== "undefined") {
    globalThis.SinglestakeLoto2f = api;
  }
  var loto2f_strategy_entry_default = api;
  return __toCommonJS(loto2f_strategy_entry_exports);
})();
