"use strict";
var SinglestakeSportingbet3f = (() => {
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

  // extension-sportingbet-3fatores/sportingbet3f-strategy-entry.ts
  var sportingbet3f_strategy_entry_exports = {};
  __export(sportingbet3f_strategy_entry_exports, {
    ROTATING_ROOM_CROSSING_BET_DELAY_MS: () => ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS: () => ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    SPORTINGBET3F_MESA_URL: () => SPORTINGBET3F_MESA_URL,
    SPORTINGBET3F_TABLE_ID: () => SPORTINGBET3F_TABLE_ID,
    createSportingbet3fEngine: () => createSportingbet3fEngine,
    default: () => sportingbet3f_strategy_entry_default
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
  var ICE_3F_CRITICAL_POSITIONS = [5, 6, 7, 9, 10, 11];
  var ICE_3F_MIN_HISTORY = 3;
  var ICE_3F_REQUIRED_TOTAL_DEFEATS = 2;
  var ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL = 3;
  var ICE_3F_GALE_MULTIPLIER = 2;
  var ICE_3F_GALE3_REFERENCE_UNITS = 8;
  var ICE_3F_CHIP_CLICK_STAGGER_MS = 150;
  var ICE_3F_BET_DELAY_MS = 5e3;
  var ICE_3F_FIRST_BET_SETTLE_MS = ICE_3F_BET_DELAY_MS;
  var ICE_3F_RECOVERY_BET_DELAY_MS = ICE_3F_BET_DELAY_MS;
  var ICE_3F_MAX_GALES = 5;
  var ICE_3F_WINS_PER_ENTRY_BUMP = 63;
  var ICE_3F_MAX_ENTRY_UNITS = 32;
  var ICE_3F_MAX_CONSECUTIVE_TRIPLES = Number.POSITIVE_INFINITY;
  var ICE_3F_GALES_AFTER_TRIPLE_LIMIT = Number.POSITIVE_INFINITY;
  function spinHead(history) {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }
  function factorWins(num, factor) {
    if (num === 0) return false;
    switch (factor.kind) {
      case "cor":
        return colorOf(num) === factor.value;
      case "altura":
        return heightOf(num) === factor.value;
      case "paridade":
        return false;
    }
  }
  function ice3fPairForNumber(n) {
    if (n === 0) return null;
    const col = colorOf(n);
    const alt = heightOf(n);
    if (col === "Zero" || alt === "Zero") return null;
    return [
      { kind: "cor", value: col },
      { kind: "altura", value: alt }
    ];
  }
  function ice3fMatchCount(result, ref) {
    if (result === 0 || ref === 0) return 0;
    const pair = ice3fPairForNumber(ref);
    if (!pair) return 0;
    return pair.filter((f) => factorWins(result, f)).length;
  }
  function ice3fClassifyMatch(result, ref) {
    if (result === 0 || ref === 0) return null;
    const count = ice3fMatchCount(result, ref);
    if (count === 2) return "total_win";
    if (count === 1) return "tie";
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
      Object.keys(watch).map((k) => {
        const pos = Number(k);
        return [pos, { ...normalizeIce3fWatchSlot(watch[pos]) }];
      })
    );
  }
  function defaultIce3fMachineState() {
    return {
      cycle: null,
      watch: emptyWatch(),
      pendingCritical: null,
      lastSpinHead: null,
      betCommitInFlight: false,
      pendingUnitScale: 0,
      pendingGaleStreak: 0,
      pendingConsecutiveTriples: 0,
      pendingGalesSinceTriple: 0,
      entryUnits: 1,
      stakeMode: "auto",
      winsTowardEntryBump: 0
    };
  }
  function ice3fNormalizeEntryUnits(raw) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 1) return 1;
    const floored = Math.max(1, Math.floor(n));
    const pow = 2 ** Math.round(Math.log2(floored));
    return Math.min(ICE_3F_MAX_ENTRY_UNITS, Math.max(1, pow));
  }
  function ice3fEntryUnitsOf(machine) {
    return ice3fNormalizeEntryUnits(machine.entryUnits ?? 1);
  }
  function ice3fStakeModeOf(machine) {
    return machine.stakeMode === "manual" ? "manual" : "auto";
  }
  function ice3fApplyWinEntryProgress(machine) {
    if (ice3fStakeModeOf(machine) !== "auto") return machine;
    const toward = Math.max(0, Math.floor(machine.winsTowardEntryBump ?? 0)) + 1;
    if (toward < ICE_3F_WINS_PER_ENTRY_BUMP) {
      return { ...machine, winsTowardEntryBump: toward };
    }
    const nextEntry = ice3fNormalizeEntryUnits(ice3fEntryUnitsOf(machine) * 2);
    return {
      ...machine,
      entryUnits: nextEntry,
      winsTowardEntryBump: 0
    };
  }
  function ice3fApplyFinalLossEntryReset(machine) {
    if (ice3fStakeModeOf(machine) !== "auto") return machine;
    if (ice3fEntryUnitsOf(machine) <= 1) {
      return { ...machine, winsTowardEntryBump: 0 };
    }
    return {
      ...machine,
      entryUnits: 1,
      winsTowardEntryBump: 0
    };
  }
  function ice3fFindEchoTrigger(historyNewestFirst) {
    if (historyNewestFirst.length < 3) return null;
    const recentNumber = historyNewestFirst[0];
    if (!Number.isFinite(recentNumber) || recentNumber === 0) return null;
    if (historyNewestFirst[1] === recentNumber) return null;
    for (let i = 2; i < historyNewestFirst.length; i++) {
      if (historyNewestFirst[i] !== recentNumber) continue;
      const signalIndex = i - 1;
      const signalNumber = historyNewestFirst[signalIndex];
      if (!Number.isFinite(signalNumber) || signalNumber === 0) return null;
      if (!ice3fPairForNumber(signalNumber)) return null;
      return {
        recentNumber,
        priorIndex: i,
        signalIndex,
        signalNumber,
        signalPosition: signalIndex + 1
      };
    }
    return null;
  }
  function ice3fBuildActiveFromHistory(historyNewestFirst, _criticalPosition) {
    const hit = ice3fFindEchoTrigger(historyNewestFirst);
    if (!hit) return null;
    const factors = ice3fPairForNumber(hit.signalNumber);
    if (!factors) return null;
    const labels = factors.map(doisFatoresFactorLabel).join(" \xB7 ");
    return {
      criticalPosition: hit.signalPosition,
      factors,
      referenceNumber: hit.signalNumber,
      triggerNumber: hit.recentNumber,
      priorOccurrencePosition: hit.priorIndex + 1,
      armingDescription: `ICE 3F eco n\xBA${hit.recentNumber}\u2192pos${hit.priorIndex + 1} \xB7 sinal pos${hit.signalPosition} n\xBA${hit.signalNumber} \u2192 ${labels}`
    };
  }
  function evaluateBetRound(result, active) {
    return ice3fClassifyBetRound(result, active.referenceNumber);
  }
  function primeIce3fWatchFromHistory(_historyNewestFirst) {
    return emptyWatch();
  }
  function tryArmCycleFromWatch(machine, historyNewestFirst, head, unitScale = 1, galeMeta) {
    if (machine.cycle) return machine;
    if (historyNewestFirst.length < ICE_3F_MIN_HISTORY) return machine;
    const active = ice3fBuildActiveFromHistory(historyNewestFirst);
    if (!active) return machine;
    const pendingScale = Math.max(0, Math.floor(machine.pendingUnitScale ?? 0));
    const entry = ice3fEntryUnitsOf(machine);
    const scale = Math.max(
      1,
      Math.floor(unitScale > 1 ? unitScale : pendingScale > 0 ? pendingScale : entry)
    );
    return {
      ...machine,
      cycle: {
        active,
        armedHead: head,
        unitScale: scale,
        galeStreak: galeMeta?.galeStreak ?? machine.pendingGaleStreak ?? 0,
        consecutiveTriples: galeMeta?.consecutiveTriples ?? machine.pendingConsecutiveTriples ?? 0,
        galesSinceTriple: galeMeta?.galesSinceTriple ?? machine.pendingGalesSinceTriple ?? 0,
        phase: "awaiting_bet"
      },
      watch: emptyWatch(),
      pendingCritical: null,
      pendingUnitScale: 0,
      pendingGaleStreak: 0,
      pendingConsecutiveTriples: 0,
      pendingGalesSinceTriple: 0
    };
  }
  function ice3fUnitScaleForCycle(cycle) {
    return Math.max(1, Math.floor(cycle.unitScale));
  }
  function ice3fDoubleClicks(unitScale) {
    const units = Math.max(1, Math.floor(unitScale));
    if (units <= 1) return 0;
    return Math.max(0, Math.round(Math.log2(units)));
  }
  function ice3fNextUnitScaleAfterLoss(currentScale) {
    return Math.max(1, Math.floor(currentScale)) * ICE_3F_GALE_MULTIPLIER;
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
      watch: cloneWatch(machine.watch ?? emptyWatch())
    };
    let nextStats = stats;
    let statsChanged = false;
    let flash = null;
    let missedBetWindow = false;
    if (nextMachine.cycle?.phase === "awaiting_bet" && headChanged && nextMachine.cycle.armedHead !== head) {
      missedBetWindow = true;
      const missedScale = ice3fUnitScaleForCycle(nextMachine.cycle);
      nextMachine = {
        ...nextMachine,
        betCommitInFlight: false,
        cycle: null,
        pendingUnitScale: Math.max(nextMachine.pendingUnitScale ?? 0, missedScale),
        pendingGaleStreak: nextMachine.cycle.galeStreak,
        pendingConsecutiveTriples: nextMachine.cycle.consecutiveTriples,
        pendingGalesSinceTriple: nextMachine.cycle.galesSinceTriple
      };
    }
    if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
      const cycle = nextMachine.cycle;
      const resultNumber = historyNewestFirst[0];
      const outcome = evaluateBetRound(resultNumber, cycle.active);
      if (outcome === "total_win" || outcome === "partial_win") {
        nextStats = recordRotatingRoomSessionWin(
          nextStats,
          cycle.galeStreak,
          ICE_3F_MAX_GALES
        );
        statsChanged = true;
        nextMachine = ice3fApplyWinEntryProgress({
          ...nextMachine,
          cycle: null,
          watch: emptyWatch(),
          pendingCritical: null,
          betCommitInFlight: false,
          pendingUnitScale: 0,
          pendingGaleStreak: 0,
          pendingConsecutiveTriples: 0,
          pendingGalesSinceTriple: 0
        });
        flash = {
          resultNumber,
          won: true,
          kind: "win",
          matchOutcome: outcome,
          criticalPosition: cycle.active.criticalPosition,
          unitScale: cycle.unitScale,
          factors: cycle.active.factors
        };
      } else if (outcome === "tie") {
        nextMachine = {
          ...nextMachine,
          betCommitInFlight: false,
          cycle: {
            ...cycle,
            phase: "awaiting_bet",
            armedHead: head
          }
        };
        flash = {
          resultNumber,
          won: false,
          kind: "tie",
          matchOutcome: "tie",
          criticalPosition: cycle.active.criticalPosition,
          unitScale: cycle.unitScale,
          factors: cycle.active.factors
        };
      } else if (outcome === "total_loss" || outcome === "partial_loss") {
        const failedScale = ice3fUnitScaleForCycle(cycle);
        const nextScale = ice3fNextUnitScaleAfterLoss(failedScale);
        const nextGaleStreak = cycle.galeStreak + 1;
        if (nextGaleStreak > ICE_3F_MAX_GALES) {
          nextStats = recordRotatingRoomSessionFinalLoss(
            nextStats,
            cycle.galeStreak,
            ICE_3F_MAX_GALES
          );
          statsChanged = true;
          nextMachine = ice3fApplyFinalLossEntryReset({
            ...nextMachine,
            cycle: null,
            betCommitInFlight: false,
            pendingUnitScale: 0,
            pendingGaleStreak: 0,
            pendingConsecutiveTriples: 0,
            pendingGalesSinceTriple: 0
          });
          flash = {
            resultNumber,
            won: false,
            kind: "cycle_fail",
            matchOutcome: outcome,
            criticalPosition: cycle.active.criticalPosition,
            unitScale: failedScale,
            factors: cycle.active.factors
          };
        } else {
          nextStats = recordRotatingRoomSessionPartialLoss(
            nextStats,
            cycle.galeStreak,
            ICE_3F_MAX_GALES
          );
          statsChanged = true;
          nextMachine = {
            ...nextMachine,
            cycle: null,
            betCommitInFlight: false,
            pendingUnitScale: nextScale,
            pendingGaleStreak: nextGaleStreak,
            pendingConsecutiveTriples: 0,
            pendingGalesSinceTriple: nextGaleStreak
          };
          flash = {
            resultNumber,
            won: false,
            kind: "loss",
            matchOutcome: outcome,
            criticalPosition: cycle.active.criticalPosition,
            unitScale: nextScale,
            factors: cycle.active.factors
          };
        }
      }
    }
    if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= ICE_3F_MIN_HISTORY) {
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
    }
    if (!nextMachine.cycle && machine.lastSpinHead == null && historyNewestFirst.length >= ICE_3F_MIN_HISTORY) {
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
    }
    if (!nextMachine.cycle && flash?.kind === "loss" && historyNewestFirst.length >= ICE_3F_MIN_HISTORY) {
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
    }
    const globalActive = nextMachine.cycle?.phase === "awaiting_bet" ? nextMachine.cycle.active : null;
    const globalUnitScale = nextMachine.cycle ? ice3fUnitScaleForCycle(nextMachine.cycle) : Math.max(
      ice3fEntryUnitsOf(nextMachine),
      Math.floor(nextMachine.pendingUnitScale ?? 0) || 0
    ) || ice3fEntryUnitsOf(nextMachine);
    return {
      machine: nextMachine,
      stats: nextStats,
      statsChanged,
      flash,
      globalActive,
      globalUnitScale,
      missedBetWindow
    };
  }
  function parseIce3fStats(raw) {
    return parseRotatingRoomSessionStats(raw, ICE_3F_MAX_GALES);
  }
  function emptyIce3fStats() {
    return emptyRotatingRoomSessionStats(ICE_3F_MAX_GALES);
  }

  // extension-sportingbet-3fatores/sportingbet3f-strategy-entry.ts
  var SPORTINGBET3F_TABLE_ID = ICE_3F_ROULETTE_TABLE_ID;
  var SPORTINGBET3F_MESA_URL = "";
  var ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_3F_FIRST_BET_SETTLE_MS;
  var ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_3F_RECOVERY_BET_DELAY_MS;
  var BASE_STAKE = 0.5;
  function createSportingbet3fEngine(options = {}) {
    let machine = defaultIce3fMachineState();
    if (options.initialMachine) {
      const im = options.initialMachine;
      machine = {
        ...machine,
        lastSpinHead: im.lastSpinHead ?? null,
        entryUnits: ice3fNormalizeEntryUnits(im.entryUnits ?? 1),
        stakeMode: im.stakeMode === "manual" ? "manual" : "auto",
        winsTowardEntryBump: Math.max(0, Math.floor(im.winsTowardEntryBump ?? 0))
      };
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
        entryUnits: ice3fEntryUnitsOf(tick.machine),
        stakeMode: ice3fStakeModeOf(tick.machine),
        winsTowardEntryBump: Math.max(0, Math.floor(tick.machine.winsTowardEntryBump ?? 0)),
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
      const stakeMode = ice3fStakeModeOf(machine);
      const entryUnits = ice3fEntryUnitsOf(machine);
      const winsTowardEntryBump = Math.max(0, Math.floor(machine.winsTowardEntryBump ?? 0));
      machine = {
        ...defaultIce3fMachineState(),
        watch,
        lastSpinHead: head,
        stakeMode,
        entryUnits,
        winsTowardEntryBump
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
    function buildBridgePayload(mesaEmbedUrl = SPORTINGBET3F_MESA_URL) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
      if (!canPlaceBet()) return null;
      const { active } = machine.cycle;
      const unitScale = ice3fUnitScaleForCycle(machine.cycle);
      const doubles = ice3fDoubleClicks(unitScale);
      const [f1, f2] = active.factors;
      const signalId = `sportingbet3f:pos${active.criticalPosition}:ref${active.referenceNumber}:s${unitScale}:h${machine.cycle.armedHead}`;
      const f1Key = pragmaticExteriorBetKeyFromFactor(f1);
      const f2Key = pragmaticExteriorBetKeyFromFactor(f2);
      const f1Label = doisFatoresFactorLabel(f1);
      const f2Label = doisFatoresFactorLabel(f2);
      const stakeAmount = BASE_STAKE * unitScale;
      const betDelayUntilMs = lastLiveSpinAt != null ? lastLiveSpinAt + ICE_3F_BET_DELAY_MS : null;
      const scaleSuffix = unitScale > 1 ? ` \xB7 ${unitScale}\xD7${doubles > 0 ? ` \xB7 dobrar \xD7${doubles}` : ""}` : " \xB7 entrada";
      const actions = [
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
        }
      ];
      for (let i = 0; i < doubles; i++) {
        actions.push({
          kind: "click",
          target: "repeat-bet",
          label: "Dobrar",
          reason: `ICE 3F \xB7 Dobrar ${i + 1}/${doubles}${scaleSuffix}`
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
          currentTableId: SPORTINGBET3F_TABLE_ID,
          mesaEmbedUrl: typeof mesaEmbedUrl === "string" && mesaEmbedUrl.trim() ? mesaEmbedUrl.trim() : SPORTINGBET3F_MESA_URL,
          mesaProvider: "outro",
          factor1Label: f1Label,
          factor2Label: f2Label,
          factor1BetKey: f1Key,
          factor2BetKey: f2Key,
          singleFactorMode: false,
          threeFactorMode: false,
          signalId,
          stakeAmount,
          units: unitScale,
          chipClicks: 1,
          useDoubleGale: true,
          doubleClicks: doubles,
          currentRecovery: Math.max(0, Math.round(Math.log2(Math.max(1, unitScale)))),
          baseStake: BASE_STAKE,
          maxRecovery: 5,
          executionMode: null,
          strategy: "tres3fatores",
          rotativaTrigger: "echo-left",
          betDelayUntilMs,
          mesaCatalog: []
        }
      };
    }
    return {
      tableId: SPORTINGBET3F_TABLE_ID,
      ingestHistorySnapshot,
      ingestSpin,
      runTick,
      buildBridgePayload,
      canPlaceBet,
      beginBetCommit,
      abortBetCommit,
      markBetPlaced,
      getState: () => ({ machine, stats, history, lastLiveSpinAt }),
      getStakeConfig: () => ({
        entryUnits: ice3fEntryUnitsOf(machine),
        stakeMode: ice3fStakeModeOf(machine),
        winsTowardEntryBump: Math.max(0, Math.floor(machine.winsTowardEntryBump ?? 0)),
        winsPerBump: ICE_3F_WINS_PER_ENTRY_BUMP,
        maxEntryUnits: ICE_3F_MAX_ENTRY_UNITS
      }),
      setStakeConfig(patch) {
        machine = {
          ...machine,
          ...patch.stakeMode != null ? { stakeMode: patch.stakeMode === "manual" ? "manual" : "auto" } : {},
          ...patch.entryUnits != null ? { entryUnits: ice3fNormalizeEntryUnits(patch.entryUnits) } : {},
          ...patch.winsTowardEntryBump != null ? {
            winsTowardEntryBump: Math.max(
              0,
              Math.floor(patch.winsTowardEntryBump)
            )
          } : {}
        };
        return {
          entryUnits: ice3fEntryUnitsOf(machine),
          stakeMode: ice3fStakeModeOf(machine),
          winsTowardEntryBump: Math.max(0, Math.floor(machine.winsTowardEntryBump ?? 0))
        };
      },
      resetStats() {
        stats = emptyIce3fStats();
      },
      reset() {
        const stakeMode = ice3fStakeModeOf(machine);
        const entryUnits = stakeMode === "manual" ? ice3fEntryUnitsOf(machine) : 1;
        machine = {
          ...defaultIce3fMachineState(),
          stakeMode,
          entryUnits,
          winsTowardEntryBump: 0
        };
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
    SPORTINGBET3F_TABLE_ID,
    SPORTINGBET3F_MESA_URL,
    ICE_3F_REQUIRED_TOTAL_DEFEATS,
    ICE_3F_REQUIRED_PARTIAL_WITH_ONE_TOTAL,
    ICE_3F_BET_DELAY_MS,
    ICE_3F_GALE3_REFERENCE_UNITS,
    ICE_3F_CHIP_CLICK_STAGGER_MS,
    ICE_3F_CRITICAL_POSITIONS,
    ICE_3F_MIN_HISTORY,
    ICE_3F_MAX_GALES,
    ICE_3F_WINS_PER_ENTRY_BUMP,
    ICE_3F_MAX_ENTRY_UNITS,
    ice3fPadFactorPlacementMs,
    ice3fDoubleClicks,
    ice3fNormalizeEntryUnits,
    createSportingbet3fEngine
  };
  if (typeof globalThis !== "undefined") {
    globalThis.SinglestakeSportingbet3f = api;
  }
  var sportingbet3f_strategy_entry_default = api;
  return __toCommonJS(sportingbet3f_strategy_entry_exports);
})();
