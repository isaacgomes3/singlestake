"use strict";
var SinglestakeIce3f = (() => {
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

  // extension-ice-3fatores/ice3f-strategy-entry.ts
  var ice3f_strategy_entry_exports = {};
  __export(ice3f_strategy_entry_exports, {
    ICE3F_MESA_URL: () => ICE3F_MESA_URL,
    ICE3F_TABLE_ID: () => ICE3F_TABLE_ID,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS: () => ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS: () => ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    createIce3fEngine: () => createIce3fEngine,
    default: () => ice3f_strategy_entry_default
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
  function parseRotatingRoomSessionStats(raw, maxRecovery = 5) {
    const o = raw ?? {};
    const base = {
      wins: Number(o.wins) || 0,
      losses: Number(o.losses) || 0,
      winsAtRecovery: parseRecoveryLevelCounts(o.winsAtRecovery, maxRecovery),
      lossesAtRecovery: parseRecoveryLevelCounts(o.lossesAtRecovery, maxRecovery)
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

  // src/lib/roulette/iceTresFatoresStrategy.ts
  var ICE_3F_ROULETTE_TABLE_ID = 201;
  var ICE_3F_ROULETTE_MESA_URL = "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal";
  var ICE_3F_CRITICAL_POSITIONS = [5, 6, 7, 9, 10, 11];
  var ICE_3F_MIN_HISTORY = 12;
  var ICE_3F_REQUIRED_TOTAL_DEFEATS = 2;
  var ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL = 3;
  var ICE_3F_GALE_MULTIPLIER = 2;
  var ICE_3F_TOTAL_LOSS_MULTIPLIER = 4;
  var ICE_3F_GALE3_REFERENCE_UNITS = 8;
  var ICE_3F_CHIP_CLICK_STAGGER_MS = 150;
  var ICE_3F_BET_DELAY_MS = 5e3;
  var ICE_3F_FIRST_BET_SETTLE_MS = ICE_3F_BET_DELAY_MS;
  var ICE_3F_RECOVERY_BET_DELAY_MS = ICE_3F_BET_DELAY_MS;
  var ICE_3F_MAX_GALE_STREAK = 5;
  var ICE_3F_MAX_CONSECUTIVE_TRIPLES = 2;
  var ICE_3F_GALES_AFTER_TRIPLE_LIMIT = 2;
  function criticalIndex(position) {
    return position - 1;
  }
  function spinHead(history) {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
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
  function ice3fTripleForNumber(n) {
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
  function ice3fMatchCount(result, ref) {
    if (result === 0 || ref === 0) return 0;
    const triple = ice3fTripleForNumber(ref);
    if (!triple) return 0;
    return triple.filter((f) => factorWins(result, f)).length;
  }
  function ice3fClassifyMatch(result, ref) {
    if (result === 0 || ref === 0) return null;
    const count = ice3fMatchCount(result, ref);
    if (count === 3) return "total_win";
    if (count === 2) return "partial_win";
    if (count === 1) return "partial_loss";
    return "total_loss";
  }
  function ice3fClassifyBetRound(result, ref) {
    if (ref === 0) return null;
    if (result === 0) return "total_loss";
    return ice3fClassifyMatch(result, ref);
  }
  function normalizeIce3fWatchSlot(raw) {
    if (typeof raw === "number") return { total: Math.max(0, raw), partial: 0 };
    return {
      total: Math.max(0, raw?.total ?? 0),
      partial: Math.max(0, raw?.partial ?? 0)
    };
  }
  function ice3fIsPositionArmed(raw) {
    const slot = normalizeIce3fWatchSlot(raw);
    return slot.total >= ICE_3F_REQUIRED_TOTAL_DEFEATS || slot.total >= 1 && slot.partial >= ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL;
  }
  function emptyWatchSlot() {
    return { total: 0, partial: 0 };
  }
  function emptyWatch() {
    return Object.fromEntries(
      ICE_3F_CRITICAL_POSITIONS.map((pos) => [pos, emptyWatchSlot()])
    );
  }
  function cloneWatch(watch) {
    return Object.fromEntries(
      ICE_3F_CRITICAL_POSITIONS.map((pos) => [pos, { ...normalizeIce3fWatchSlot(watch[pos]) }])
    );
  }
  function defaultIce3fMachineState() {
    return {
      cycle: null,
      watch: emptyWatch(),
      pendingCritical: null,
      lastSpinHead: null
    };
  }
  function referenceAtGridPosition(historyNewestFirst, position) {
    const idx = criticalIndex(position);
    if (historyNewestFirst.length <= idx) return null;
    return historyNewestFirst[idx];
  }
  function referenceBeforeSpin(historyNewestFirst, position) {
    if (historyNewestFirst.length <= position) return null;
    return historyNewestFirst[position];
  }
  function ice3fBuildActiveFromHistory(historyNewestFirst, criticalPosition) {
    const refNum = referenceAtGridPosition(historyNewestFirst, criticalPosition);
    if (refNum == null) return null;
    const factors = ice3fTripleForNumber(refNum);
    if (!factors) return null;
    const labels = factors.map(doisFatoresFactorLabel).join(" \xB7 ");
    return {
      criticalPosition,
      factors,
      referenceNumber: refNum,
      armingDescription: `ICE 3F pos${criticalPosition}: n\xBA${refNum} \u2192 ${labels}`
    };
  }
  function cycleFailed(cycle) {
    if (cycle.galeStreak >= ICE_3F_MAX_GALE_STREAK) return true;
    if (cycle.consecutiveTriples >= ICE_3F_MAX_CONSECUTIVE_TRIPLES) return true;
    if (cycle.consecutiveTriples >= 1 && cycle.galesSinceTriple >= ICE_3F_GALES_AFTER_TRIPLE_LIMIT) {
      return true;
    }
    return false;
  }
  function evaluateBetRound(result, active) {
    return ice3fClassifyBetRound(result, active.referenceNumber);
  }
  function updateWatchOnSpin(watch, historyNewestFirst) {
    const result = historyNewestFirst[0];
    const next = cloneWatch(watch);
    for (const pos of ICE_3F_CRITICAL_POSITIONS) {
      const ref = referenceBeforeSpin(historyNewestFirst, pos);
      if (ref == null) continue;
      const outcome = ice3fClassifyMatch(result, ref);
      if (outcome == null) continue;
      if (outcome === "total_win" || outcome === "partial_win") {
        next[pos] = emptyWatchSlot();
      } else if (outcome === "total_loss") {
        next[pos] = {
          total: Math.min(ICE_3F_REQUIRED_TOTAL_DEFEATS, next[pos].total + 1),
          partial: next[pos].partial
        };
      } else if (outcome === "partial_loss") {
        next[pos] = {
          total: next[pos].total,
          partial: next[pos].partial + 1
        };
      }
    }
    return next;
  }
  function primeIce3fWatchFromHistory(historyNewestFirst) {
    if (historyNewestFirst.length < ICE_3F_MIN_HISTORY) return emptyWatch();
    let watch = emptyWatch();
    const chronological = [...historyNewestFirst].reverse();
    for (let end = ICE_3F_MIN_HISTORY; end <= chronological.length; end++) {
      const sliceNewestFirst = chronological.slice(0, end).reverse();
      watch = updateWatchOnSpin(watch, sliceNewestFirst);
    }
    return watch;
  }
  function tryArmCycleFromWatch(machine, historyNewestFirst, head) {
    if (machine.cycle) return machine;
    const armedPos = firstArmedPosition(machine.watch);
    if (armedPos == null) return machine;
    const active = ice3fBuildActiveFromHistory(historyNewestFirst, armedPos);
    if (!active) return machine;
    return {
      ...machine,
      cycle: {
        active,
        armedHead: head,
        unitScale: 1,
        galeStreak: 0,
        consecutiveTriples: 0,
        galesSinceTriple: 0,
        phase: "awaiting_bet"
      },
      watch: { ...machine.watch, [armedPos]: emptyWatchSlot() },
      pendingCritical: null
    };
  }
  function firstArmedPosition(watch) {
    for (const pos of ICE_3F_CRITICAL_POSITIONS) {
      if (ice3fIsPositionArmed(watch[pos])) return pos;
    }
    return null;
  }
  function ice3fUnitScaleForCycle(cycle) {
    return Math.max(1, Math.floor(cycle.unitScale));
  }
  function ice3fNextUnitScaleAfterLoss(currentScale, outcome) {
    const base = Math.max(1, Math.floor(currentScale));
    return outcome === "total_loss" ? base * ICE_3F_TOTAL_LOSS_MULTIPLIER : base * ICE_3F_GALE_MULTIPLIER;
  }
  function ice3fPadFactorPlacementMs(unitScale) {
    const units = Math.max(1, Math.floor(unitScale));
    if (units >= ICE_3F_GALE3_REFERENCE_UNITS) return 0;
    return (ICE_3F_GALE3_REFERENCE_UNITS - units) * ICE_3F_CHIP_CLICK_STAGGER_MS;
  }
  function ice3fBetDelayMs(_unitScale) {
    return ICE_3F_BET_DELAY_MS;
  }
  function canPlaceIce3fBet(unitScale, lastSpinAtMs, nowMs = Date.now()) {
    if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
    return nowMs - lastSpinAtMs >= ice3fBetDelayMs(unitScale);
  }
  function tickIce3fPlacar(historyNewestFirst, machine, stats) {
    const head = spinHead(historyNewestFirst);
    const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
    let nextMachine = {
      ...machine,
      lastSpinHead: head,
      watch: cloneWatch(machine.watch)
    };
    let nextStats = stats;
    let statsChanged = false;
    let flash = null;
    if (nextMachine.cycle?.phase === "awaiting_bet" && headChanged && nextMachine.cycle.armedHead !== head) {
      if (nextMachine.betCommitInFlight) {
        nextMachine = {
          ...nextMachine,
          betCommitInFlight: false,
          cycle: { ...nextMachine.cycle, phase: "awaiting_result" }
        };
      } else {
        nextMachine = { ...nextMachine, cycle: null };
      }
    }
    if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
      const cycle = nextMachine.cycle;
      const resultNumber = historyNewestFirst[0];
      const outcome = evaluateBetRound(resultNumber, cycle.active);
      if (outcome === "total_win" || outcome === "partial_win") {
        nextStats = recordRotatingRoomSessionWin(nextStats, 0, 0);
        statsChanged = true;
        nextMachine = {
          ...nextMachine,
          cycle: null,
          watch: emptyWatch(),
          pendingCritical: null,
          betCommitInFlight: false
        };
        flash = {
          resultNumber,
          won: true,
          kind: "win",
          matchOutcome: outcome,
          criticalPosition: cycle.active.criticalPosition,
          unitScale: cycle.unitScale,
          factors: cycle.active.factors
        };
      } else if (outcome === "partial_loss" || outcome === "total_loss") {
        const isTotal = outcome === "total_loss";
        const failedScale = ice3fUnitScaleForCycle(cycle);
        let nextCycle = {
          ...cycle,
          unitScale: ice3fNextUnitScaleAfterLoss(failedScale, outcome),
          galeStreak: isTotal ? 0 : cycle.galeStreak + 1,
          consecutiveTriples: isTotal ? cycle.consecutiveTriples + 1 : 0,
          galesSinceTriple: isTotal ? 0 : cycle.galesSinceTriple + 1,
          phase: "awaiting_bet"
        };
        const rebuilt = ice3fBuildActiveFromHistory(
          historyNewestFirst,
          cycle.active.criticalPosition
        );
        if (rebuilt) {
          nextCycle = { ...nextCycle, active: rebuilt };
        }
        if (cycleFailed(nextCycle)) {
          nextStats = recordRotatingRoomSessionFinalLoss(nextStats, 0, 0);
          statsChanged = true;
          nextMachine = {
            ...nextMachine,
            cycle: null,
            watch: emptyWatch(),
            pendingCritical: null,
            betCommitInFlight: false
          };
          flash = {
            resultNumber,
            won: false,
            kind: "cycle_fail",
            matchOutcome: outcome,
            criticalPosition: cycle.active.criticalPosition,
            unitScale: nextCycle.unitScale,
            factors: cycle.active.factors
          };
        } else {
          nextMachine = {
            ...nextMachine,
            cycle: { ...nextCycle, armedHead: head },
            betCommitInFlight: false
          };
          flash = {
            resultNumber,
            won: false,
            kind: "loss",
            matchOutcome: outcome,
            criticalPosition: cycle.active.criticalPosition,
            unitScale: nextCycle.unitScale,
            factors: cycle.active.factors
          };
        }
      }
    }
    if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= ICE_3F_MIN_HISTORY) {
      nextMachine = {
        ...nextMachine,
        watch: updateWatchOnSpin(nextMachine.watch, historyNewestFirst)
      };
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
    }
    if (nextMachine.cycle && headChanged) {
      const armedPos = firstArmedPosition(nextMachine.watch);
      if (armedPos != null && armedPos !== nextMachine.cycle.active.criticalPosition) {
        nextMachine = { ...nextMachine, pendingCritical: armedPos };
      }
    }
    if (!nextMachine.cycle && nextMachine.pendingCritical != null && headChanged) {
      const pos = nextMachine.pendingCritical;
      if (ice3fIsPositionArmed(nextMachine.watch[pos])) {
        nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
        if (nextMachine.cycle) {
          nextMachine = { ...nextMachine, pendingCritical: null };
        }
      }
    }
    const globalActive = nextMachine.cycle?.phase === "awaiting_bet" ? nextMachine.cycle.active : null;
    const globalUnitScale = nextMachine.cycle ? ice3fUnitScaleForCycle(nextMachine.cycle) : 1;
    return {
      machine: nextMachine,
      stats: nextStats,
      statsChanged,
      flash,
      globalActive,
      globalUnitScale
    };
  }
  function parseIce3fStats(raw) {
    return parseRotatingRoomSessionStats(raw, 0);
  }
  function emptyIce3fStats() {
    return emptyRotatingRoomSessionStats(0);
  }

  // extension-ice-3fatores/ice3f-strategy-entry.ts
  var ICE3F_TABLE_ID = ICE_3F_ROULETTE_TABLE_ID;
  var ICE3F_MESA_URL = ICE_3F_ROULETTE_MESA_URL;
  var ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_3F_FIRST_BET_SETTLE_MS;
  var ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_3F_RECOVERY_BET_DELAY_MS;
  var BASE_STAKE = 0.5;
  function createIce3fEngine(options = {}) {
    let machine = defaultIce3fMachineState();
    if (options.initialMachine?.lastSpinHead) {
      machine = { ...machine, lastSpinHead: options.initialMachine.lastSpinHead };
    }
    let stats = options.initialStats != null ? parseIce3fStats(options.initialStats) : emptyIce3fStats();
    let history = [];
    let lastGameId = null;
    let spinBaselined = false;
    let liveSpinSeen = false;
    let lastLiveSpinAt = null;
    function spinHead2() {
      if (history.length === 0) return "0";
      return `${history.length}:${history[0]}`;
    }
    function toEngineResult(tick) {
      const unitScale = tick.globalUnitScale;
      return {
        active: tick.globalActive,
        unitScale,
        recovery: unitScale,
        machine: tick.machine,
        stats: tick.stats,
        flash: tick.flash
      };
    }
    function anchorSpinClock() {
      lastLiveSpinAt = Date.now();
    }
    function runTick() {
      const tick = tickIce3fPlacar(history, machine, stats);
      machine = tick.machine;
      stats = tick.stats;
      return toEngineResult(tick);
    }
    function ingestHistorySnapshot(spins) {
      if (liveSpinSeen) return null;
      history = spins.map((s) => s.number);
      if (spins[0]) {
        lastGameId = spins[0].gameId;
        spinBaselined = true;
      }
      const head = spinHead2();
      const watch = primeIce3fWatchFromHistory(history);
      machine = {
        ...defaultIce3fMachineState(),
        watch,
        lastSpinHead: head
      };
      if (history.length >= ICE_3F_MIN_HISTORY) {
        machine = tryArmCycleFromWatch(machine, history, head);
      }
      lastLiveSpinAt = Date.now();
      const tick = tickIce3fPlacar(history, machine, stats);
      machine = tick.machine;
      return toEngineResult(tick);
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
      const scale = ice3fUnitScaleForCycle(machine.cycle);
      return canPlaceIce3fBet(scale, lastLiveSpinAt, nowMs);
    }
    function beginBetCommit() {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
      machine = { ...machine, betCommitInFlight: true };
      return true;
    }
    function abortBetCommit() {
      if (!machine.betCommitInFlight) return;
      machine = { ...machine, betCommitInFlight: false };
    }
    function markBetPlaced() {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") {
        machine = { ...machine, betCommitInFlight: false };
        return;
      }
      machine = {
        ...machine,
        betCommitInFlight: false,
        cycle: { ...machine.cycle, phase: "awaiting_result" }
      };
    }
    function buildBridgePayload(mesaEmbedUrl = ICE3F_MESA_URL) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
      if (!canPlaceBet()) return null;
      const { active } = machine.cycle;
      const unitScale = ice3fUnitScaleForCycle(machine.cycle);
      const [f1, f2, f3] = active.factors;
      const signalId = `ice3f:pos${active.criticalPosition}:ref${active.referenceNumber}:s${unitScale}`;
      const f1Key = pragmaticExteriorBetKeyFromFactor(f1);
      const f2Key = pragmaticExteriorBetKeyFromFactor(f2);
      const f3Key = pragmaticExteriorBetKeyFromFactor(f3);
      const f1Label = doisFatoresFactorLabel(f1);
      const f2Label = doisFatoresFactorLabel(f2);
      const f3Label = doisFatoresFactorLabel(f3);
      const stakeAmount = BASE_STAKE * unitScale;
      const betDelayUntilMs = lastLiveSpinAt != null ? lastLiveSpinAt + ICE_3F_BET_DELAY_MS : null;
      const scaleSuffix = unitScale > 1 ? ` \xB7 ${unitScale}\xD7` : " \xB7 entrada";
      return {
        type: "game-odds-glow/rotating-room-extension",
        version: 1,
        fingerprint: signalId,
        actions: [
          {
            kind: "click",
            target: "factor-1",
            label: f1Label,
            reason: `ICE 3F \xB7 ${f1Label}${scaleSuffix}`
          },
          {
            kind: "click",
            target: "factor-2",
            label: f2Label,
            reason: `ICE 3F \xB7 ${f2Label}${scaleSuffix}`
          },
          {
            kind: "click",
            target: "factor-3",
            label: f3Label,
            reason: `ICE 3F \xB7 ${f3Label}${scaleSuffix}`
          }
        ],
        context: {
          sessionMode: "active",
          prepareTableId: null,
          currentTableId: ICE3F_TABLE_ID,
          mesaEmbedUrl: mesaEmbedUrl ?? ICE3F_MESA_URL,
          mesaProvider: "outro",
          factor1Label: f1Label,
          factor2Label: f2Label,
          factor3Label: f3Label,
          factor1BetKey: f1Key,
          factor2BetKey: f2Key,
          factor3BetKey: f3Key,
          singleFactorMode: false,
          threeFactorMode: true,
          signalId,
          stakeAmount,
          units: unitScale,
          currentRecovery: 0,
          baseStake: BASE_STAKE,
          maxRecovery: 0,
          executionMode: null,
          strategy: "tres3fatores",
          rotativaTrigger: "critical",
          betDelayUntilMs,
          mesaCatalog: []
        }
      };
    }
    return {
      tableId: ICE3F_TABLE_ID,
      ingestHistorySnapshot,
      ingestSpin,
      runTick,
      buildBridgePayload,
      canPlaceBet,
      beginBetCommit,
      abortBetCommit,
      markBetPlaced,
      getState: () => ({ machine, stats, history, lastLiveSpinAt }),
      resetStats() {
        stats = emptyIce3fStats();
      },
      reset() {
        machine = defaultIce3fMachineState();
        stats = emptyIce3fStats();
        history = [];
        lastGameId = null;
        spinBaselined = false;
        liveSpinSeen = false;
        lastLiveSpinAt = null;
      }
    };
  }
  var api = {
    ICE3F_TABLE_ID,
    ICE3F_MESA_URL,
    ICE_3F_REQUIRED_TOTAL_DEFEATS,
    ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL,
    ICE_3F_BET_DELAY_MS,
    ICE_3F_GALE3_REFERENCE_UNITS,
    ICE_3F_CHIP_CLICK_STAGGER_MS,
    ICE_3F_CRITICAL_POSITIONS,
    ICE_3F_MIN_HISTORY,
    ice3fPadFactorPlacementMs,
    createIce3fEngine
  };
  if (typeof globalThis !== "undefined") {
    globalThis.SinglestakeIce3f = api;
  }
  var ice3f_strategy_entry_default = api;
  return __toCommonJS(ice3f_strategy_entry_exports);
})();
