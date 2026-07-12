"use strict";
var SinglestakeKto2f = (() => {
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

  // extension-kto-cruzamento-2f/kto2f-strategy-entry.ts
  var kto2f_strategy_entry_exports = {};
  __export(kto2f_strategy_entry_exports, {
    KTO2F_MAX_GALES: () => KTO2F_MAX_GALES,
    KTO2F_MESA_URL: () => KTO2F_MESA_URL,
    KTO2F_TABLE_ID: () => KTO2F_TABLE_ID,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS: () => ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS: () => ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    createKto2fEngine: () => createKto2fEngine,
    default: () => kto2f_strategy_entry_default
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

  // src/lib/roulette/iceCruzamento2fStrategy.ts
  var ICE_2F_COMPARE_POSITIONS = [11, 22];
  var ICE_2F_MIN_HISTORY = 22;
  var ICE_2F_MAX_RECOVERY = 5;
  var ICE_2F_REQUIRED_FAILURES = 0;
  var ICE_2F_RECOVERY_BET_DELAY_MS = 6e3;
  var ICE_2F_IMMEDIATE_REBET_DELAY_MS = 6e3;
  var ICE_2F_FIRST_BET_SETTLE_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
  var ICE_2F_BET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
  var ICE_2F_STAKE_UNITS = [1, 2, 4, 8, 16, 32];
  function ice2fPadFactorPlacementMs(_units) {
    return 0;
  }
  function emptyWatchSlot() {
    return { failures: 0 };
  }
  function emptyWatchAxisMap() {
    return {
      "cor-altura": emptyWatchSlot(),
      "altura-paridade": emptyWatchSlot(),
      "cor-paridade": emptyWatchSlot()
    };
  }
  function emptyWatch() {
    const w = {};
    for (const pos of ICE_2F_COMPARE_POSITIONS) w[pos] = emptyWatchAxisMap();
    return w;
  }
  function cloneWatch(watch) {
    const next = {};
    for (const key of Object.keys(watch)) {
      const pos = Number(key);
      const slot = watch[pos];
      if (!slot) continue;
      next[pos] = {
        "cor-altura": { failures: slot["cor-altura"]?.failures ?? 0 },
        "altura-paridade": { failures: slot["altura-paridade"]?.failures ?? 0 },
        "cor-paridade": { failures: slot["cor-paridade"]?.failures ?? 0 }
      };
    }
    return next;
  }
  function defaultIce2fMachineState() {
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
      zeroDebtUnits: 0,
      zeroRecoveredUnits: 0,
      zeroShift: 0,
      zeroRecoveryArmed: false
    };
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
  function ice2fFindCriticalPosition(historyNewestFirst) {
    if (historyNewestFirst.length < ICE_2F_MIN_HISTORY) return null;
    const number11 = historyNewestFirst[10];
    const number22 = historyNewestFirst[21];
    if (!Number.isFinite(number11) || !Number.isFinite(number22)) return null;
    if (number11 === 0 || number22 === 0) return null;
    const sharedCount = umFatorTriggerMatchCount(number11, number22);
    if (sharedCount < 2) return null;
    let axis;
    let factor1;
    let factor2;
    if (sharedCount >= 3) {
      axis = "cor-paridade";
      const factors = factorsForNumberOnAxis(number11, axis);
      if (!factors) return null;
      factor1 = factors[0];
      factor2 = factors[1];
    } else {
      const shared = umFatorSharedFactorsBetween(number11, number22);
      if (shared.length !== 2) return null;
      factor1 = shared[0];
      factor2 = shared[1];
      axis = pairKindFromFactors(factor1, factor2);
    }
    return {
      criticalPosition: 11,
      matchPosition: 22,
      matchNumber: number22,
      triggerNumber: number11,
      axis,
      factor1,
      factor2,
      sharedCount: sharedCount >= 3 ? 3 : 2
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
    return {
      criticalPosition: hit.criticalPosition,
      axis: hit.axis,
      factor1: hit.factor1,
      factor2: hit.factor2,
      pairKind: pairKindFromCrossingAxis(hit.axis),
      referenceNumber: hit.triggerNumber,
      armingDescription: `2F pos11/22 ${axisLabelPt(hit.axis)}: n\xBA${hit.triggerNumber}\xB7${hit.matchNumber} \u2192 ${labels}${tripleHint}`,
      matchPosition: hit.matchPosition,
      matchNumber: hit.matchNumber,
      triggerNumber: hit.triggerNumber
    };
  }
  function primeIce2fWatchFromHistory(_historyNewestFirst) {
    return emptyWatch();
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
  function armCycleFromHit(machine, head, hit, recovery) {
    const active = ice2fBuildActiveFromHit(hit);
    return {
      ...machine,
      lockedPosition: hit.criticalPosition,
      nextEntryAxis: hit.axis,
      inactiveSpinsWithoutEntry: 0,
      pendingArm: null,
      pendingRecovery: 0,
      cycle: {
        active,
        armedHead: head,
        recovery,
        phase: "awaiting_bet",
        immediateBet: recovery > 0
      }
    };
  }
  function tryArmCycleFromWatch(machine, historyNewestFirst, head) {
    if (machine.cycle) return machine;
    if (historyNewestFirst.length < ICE_2F_MIN_HISTORY) return machine;
    const pendingRecovery = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
    const hit = ice2fFindCriticalPosition(historyNewestFirst);
    if (!hit) return machine;
    return armCycleFromHit(
      { ...machine, betCommitInFlight: false },
      head,
      hit,
      pendingRecovery
    );
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
      pendingRecovery: machine.pendingRecovery ?? 0
    };
    let nextStats = stats;
    let statsChanged = false;
    let flash = null;
    let missedBetWindow = false;
    if (nextMachine.cycle?.phase === "awaiting_bet" && headChanged && nextMachine.cycle.armedHead !== head) {
      missedBetWindow = true;
      nextMachine = ice2fClearCycleKeepGale(nextMachine, nextMachine.cycle.recovery);
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
        statsChanged = true;
        nextMachine = ice2fClearCycleKeepGale(
          applyWinZeroRecoveryAccounting(nextMachine, wonUnits),
          0
        );
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
        nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recovery, maxRecovery);
        statsChanged = true;
        nextMachine = ice2fClearCycleKeepGale(nextMachine, recovery);
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
          statsChanged = true;
          nextMachine = {
            ...ice2fClearCycleKeepGale(nextMachine, 0),
            nextEntryAxis: ice2fToggleAxis(active.axis)
          };
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
        }
      }
    }
    if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= ICE_2F_MIN_HISTORY) {
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
    }
    if (!nextMachine.cycle && machine.lastSpinHead == null && historyNewestFirst.length >= ICE_2F_MIN_HISTORY) {
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
  function parseIce2fStats(raw, maxRecovery = ICE_2F_MAX_RECOVERY) {
    return parseRotatingRoomSessionStats(raw, maxRecovery);
  }
  function emptyIce2fStats(maxRecovery = ICE_2F_MAX_RECOVERY) {
    return emptyRotatingRoomSessionStats(maxRecovery);
  }
  function formatIce2fWatchLabel(_watch, _requiredFailures = ICE_2F_REQUIRED_FAILURES) {
    return "pos 11\xD722 \xB7 2F em comum";
  }
  function ice2fWatchLabelForMachine(machine) {
    const pending = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
    const cycle = machine.cycle?.active;
    if (cycle) {
      return `11/22 ${axisShort(cycle.axis)} \xB7 gale ${machine.cycle?.recovery ?? 0}`;
    }
    return pending > 0 ? `aguarda 11/22 \xB7 gale ${pending}` : "aguarda 11/22 \xB7 2F em comum";
  }

  // extension-kto-cruzamento-2f/kto2f-strategy-entry.ts
  var KTO2F_TABLE_ID = 230;
  var KTO2F_MESA_URL = "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/";
  var KTO2F_MAX_GALES = ICE_2F_MAX_RECOVERY;
  var ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_2F_FIRST_BET_SETTLE_MS;
  var ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
  var BASE_STAKE = 0.5;
  var KTO2F_POSITIONS = /* @__PURE__ */ new Set([11, 22]);
  var KTO2F_AXES = /* @__PURE__ */ new Set(["cor-altura", "altura-paridade", "cor-paridade"]);
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
  function createKto2fEngine(options = {}) {
    const maxRecovery = clampMaxRecovery(options.maxRecovery);
    let machine = defaultIce2fMachineState();
    if (options.initialMachine) {
      const saved = options.initialMachine;
      machine = {
        ...machine,
        lastSpinHead: saved.lastSpinHead ?? null,
        nextEntryAxis: saved.nextEntryAxis && KTO2F_AXES.has(saved.nextEntryAxis) ? saved.nextEntryAxis : "cor-altura",
        lockedPosition: typeof saved.lockedPosition === "number" && KTO2F_POSITIONS.has(saved.lockedPosition) ? saved.lockedPosition : null,
        pendingRecovery: typeof saved.pendingRecovery === "number" && Number.isFinite(saved.pendingRecovery) ? Math.max(0, Math.floor(saved.pendingRecovery)) : 0
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
        flash: tick.flash
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
        const axis = (pendingRestore.nextEntryAxis && KTO2F_AXES.has(pendingRestore.nextEntryAxis) ? pendingRestore.nextEntryAxis : null) ?? (pendingRestore.axis && KTO2F_AXES.has(pendingRestore.axis) ? pendingRestore.axis : null) ?? "cor-altura";
        const locked = typeof pendingRestore.lockedPosition === "number" && KTO2F_POSITIONS.has(pendingRestore.lockedPosition) ? pendingRestore.lockedPosition : null;
        const pendingRecovery = pendingRecoveryFromSaved(pendingRestore);
        pendingRestore = null;
        machine = {
          ...machine,
          nextEntryAxis: axis,
          lockedPosition: locked,
          pendingRecovery
        };
        if (history.length >= ICE_2F_MIN_HISTORY) {
          machine = tryArmCycleFromWatch(machine, history, head);
        }
      } else if (history.length >= ICE_2F_MIN_HISTORY) {
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
        flash: tick.flash
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
        cycle: { ...machine.cycle, phase: "awaiting_result", immediateBet: false }
      };
    }
    function buildBridgePayload(mesaEmbedUrl = KTO2F_MESA_URL) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
      if (!canPlaceBet()) return null;
      const { active, recovery } = machine.cycle;
      const zeroShift = ice2fEffectiveZeroShift(machine);
      const units = ice2fStakeUnits(recovery, zeroShift);
      const doubles = ice2fDoubleClicks(recovery, zeroShift);
      const signalId = `kto2f:pos${active.criticalPosition}:${active.axis}:ref${active.referenceNumber}:r${recovery}`;
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
          reason: `KTO 2F \xB7 ${f1Label}${galeSuffix}`
        },
        {
          kind: "click",
          target: "factor-2",
          label: f2Label,
          reason: `KTO 2F \xB7 ${f2Label}${galeSuffix}`
        }
      ];
      for (let i = 0; i < doubles; i++) {
        actions.push({
          kind: "click",
          target: "repeat-bet",
          label: "Dobrar",
          reason: `KTO 2F \xB7 Dobrar ${i + 1}/${doubles}${galeSuffix}`
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
          currentTableId: KTO2F_TABLE_ID,
          mesaEmbedUrl: mesaEmbedUrl ?? KTO2F_MESA_URL,
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
          strategy: "kto2fcruzamento",
          rotativaTrigger: "critical",
          betDelayUntilMs,
          mesaCatalog: []
        }
      };
    }
    return {
      tableId: KTO2F_TABLE_ID,
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
    KTO2F_TABLE_ID,
    KTO2F_MESA_URL,
    KTO2F_MAX_GALES,
    ICE_2F_BET_DELAY_MS,
    ICE_2F_FIRST_BET_SETTLE_MS,
    ICE_2F_IMMEDIATE_REBET_DELAY_MS,
    ICE_2F_MAX_RECOVERY,
    ICE_2F_RECOVERY_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    formatIce2fWatchLabel,
    ice2fWatchLabelForMachine,
    ice2fBetDelayMs,
    ice2fBetDelayUntilMs,
    ice2fPadFactorPlacementMs,
    ice2fDoubleClicks,
    ice2fEffectiveZeroShift,
    ice2fStakeUnits,
    createKto2fEngine
  };
  if (typeof globalThis !== "undefined") {
    globalThis.SinglestakeKto2f = api;
  }
  var kto2f_strategy_entry_default = api;
  return __toCommonJS(kto2f_strategy_entry_exports);
})();
