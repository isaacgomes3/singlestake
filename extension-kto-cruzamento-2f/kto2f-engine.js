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
  var ICE_2F_CRITICAL_POSITIONS = [5, 6, 7, 9, 10, 11];
  var ICE_2F_CROSSING_AXES = ["cor-altura", "altura-paridade"];
  var ICE_2F_MIN_HISTORY = 12;
  var ICE_2F_REQUIRED_FAILURES = 4;
  var ICE_2F_MAX_RECOVERY = 5;
  var ICE_2F_FIRST_BET_SETTLE_MS = 13e3;
  var ICE_2F_RECOVERY_BET_DELAY_MS = 5e3;
  var ICE_2F_BET_DELAY_MS = ICE_2F_FIRST_BET_SETTLE_MS;
  var ICE_2F_STAKE_UNITS = [1, 2, 4, 8, 16, 32];
  var ICE_2F_GALE3_REFERENCE_UNITS = 8;
  function ice2fPadFactorPlacementMs(units) {
    const u = Math.max(1, Math.floor(units));
    if (u >= ICE_2F_GALE3_REFERENCE_UNITS) return 0;
    const base = 150;
    return (ICE_2F_GALE3_REFERENCE_UNITS - u) * base;
  }
  function criticalIndex(position) {
    return position - 1;
  }
  function spinHead(history) {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }
  function emptyWatchSlot() {
    return { failures: 0 };
  }
  function emptyWatchAxisMap() {
    return {
      "cor-altura": emptyWatchSlot(),
      "altura-paridade": emptyWatchSlot()
    };
  }
  function emptyWatch() {
    return Object.fromEntries(
      ICE_2F_CRITICAL_POSITIONS.map((pos) => [pos, emptyWatchAxisMap()])
    );
  }
  function cloneWatch(watch) {
    const next = {};
    for (const pos of ICE_2F_CRITICAL_POSITIONS) {
      next[pos] = {
        "cor-altura": { ...watch[pos]["cor-altura"] },
        "altura-paridade": { ...watch[pos]["altura-paridade"] }
      };
    }
    return next;
  }
  function defaultIce2fMachineState() {
    return {
      cycle: null,
      watch: emptyWatch(),
      pendingArm: null,
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
  function toTapeteActive(active) {
    return {
      pairKind: active.pairKind,
      pairKindLabel: active.axis,
      patternMode: "convergence",
      patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
      referenceNumber: active.referenceNumber,
      factor1: active.factor1,
      factor2: active.factor2,
      triggerNumbers: [active.referenceNumber, active.referenceNumber],
      armingDescription: active.armingDescription
    };
  }
  function classifyObservation(result, ref, axis) {
    if (result === 0 || ref === 0) return null;
    const factors = factorsForNumberOnAxis(ref, axis);
    if (!factors) return null;
    const round = evaluateDoisFatoresRound(result, {
      pairKind: pairKindFromCrossingAxis(axis),
      pairKindLabel: axis,
      patternMode: "convergence",
      patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
      referenceNumber: ref,
      factor1: factors[0],
      factor2: factors[1],
      triggerNumbers: [ref, ref],
      armingDescription: ""
    });
    if (round === "W") return "win";
    if (round === "continue") return "tie";
    return "loss";
  }
  function ice2fClassifyBetRound(result, active) {
    if (result === 0) return "L";
    return evaluateDoisFatoresRound(result, toTapeteActive(active));
  }
  function ice2fIsWatchSlotArmed(slot) {
    return slot.failures >= ICE_2F_REQUIRED_FAILURES;
  }
  function ice2fBuildActiveFromHistory(historyNewestFirst, position, axis) {
    const refNum = referenceAtGridPosition(historyNewestFirst, position);
    if (refNum == null || refNum === 0) return null;
    const factors = factorsForNumberOnAxis(refNum, axis);
    if (!factors) return null;
    const labels = factors.map((f) => doisFatoresFactorLabel(f)).join(" \xB7 ");
    const axisLabel = axis === "cor-altura" ? "cor/altura" : "paridade/altura";
    return {
      criticalPosition: position,
      axis,
      factor1: factors[0],
      factor2: factors[1],
      pairKind: pairKindFromCrossingAxis(axis),
      referenceNumber: refNum,
      armingDescription: `ICE 2F pos${position} ${axisLabel}: n\xBA${refNum} \u2192 ${labels}`
    };
  }
  function updateWatchOnSpin(watch, historyNewestFirst) {
    const result = historyNewestFirst[0];
    const next = cloneWatch(watch);
    for (const pos of ICE_2F_CRITICAL_POSITIONS) {
      const ref = referenceBeforeSpin(historyNewestFirst, pos);
      if (ref == null) continue;
      for (const axis of ICE_2F_CROSSING_AXES) {
        const outcome = classifyObservation(result, ref, axis);
        if (outcome == null) continue;
        if (outcome === "win") {
          next[pos][axis] = emptyWatchSlot();
        } else if (outcome === "loss") {
          next[pos][axis] = {
            failures: Math.min(ICE_2F_REQUIRED_FAILURES, next[pos][axis].failures + 1)
          };
        }
      }
    }
    return next;
  }
  function primeIce2fWatchFromHistory(historyNewestFirst) {
    if (historyNewestFirst.length < ICE_2F_MIN_HISTORY) return emptyWatch();
    let watch = emptyWatch();
    const chronological = [...historyNewestFirst].reverse();
    for (let end = ICE_2F_MIN_HISTORY; end <= chronological.length; end++) {
      const sliceNewestFirst = chronological.slice(0, end).reverse();
      watch = updateWatchOnSpin(watch, sliceNewestFirst);
    }
    return watch;
  }
  function firstArmedSlot(watch) {
    for (const pos of ICE_2F_CRITICAL_POSITIONS) {
      for (const axis of ICE_2F_CROSSING_AXES) {
        if (ice2fIsWatchSlotArmed(watch[pos][axis])) return { position: pos, axis };
      }
    }
    return null;
  }
  function ice2fResumeCycleAfterRebuild(cycle, historyNewestFirst, head) {
    const rebuilt = ice2fBuildActiveFromHistory(
      historyNewestFirst,
      cycle.active.criticalPosition,
      cycle.active.axis
    );
    if (rebuilt) {
      return {
        ...cycle,
        active: rebuilt,
        phase: "awaiting_bet",
        armedHead: head
      };
    }
    return {
      ...cycle,
      phase: "awaiting_reference",
      armedHead: head
    };
  }
  function tryArmCycleFromWatch(machine, historyNewestFirst, head) {
    if (machine.cycle) return machine;
    const armed = firstArmedSlot(machine.watch);
    if (armed == null) return machine;
    const active = ice2fBuildActiveFromHistory(
      historyNewestFirst,
      armed.position,
      armed.axis
    );
    if (!active) return machine;
    return {
      ...machine,
      cycle: {
        active,
        armedHead: head,
        recovery: 0,
        phase: "awaiting_bet"
      },
      watch: {
        ...machine.watch,
        [armed.position]: {
          ...machine.watch[armed.position],
          [armed.axis]: emptyWatchSlot()
        }
      },
      pendingArm: null
    };
  }
  function ice2fStakeUnits(recovery) {
    const idx = Math.min(
      Math.max(0, Math.floor(recovery)),
      ICE_2F_STAKE_UNITS.length - 1
    );
    return ICE_2F_STAKE_UNITS[idx];
  }
  function ice2fBetDelayMs(recovery) {
    return (recovery ?? 0) > 0 ? ICE_2F_RECOVERY_BET_DELAY_MS : ICE_2F_FIRST_BET_SETTLE_MS;
  }
  function ice2fBetDelayUntilMs(recovery, lastSpinAtMs) {
    const delayMs = ice2fBetDelayMs(recovery);
    return lastSpinAtMs != null && Number.isFinite(lastSpinAtMs) ? lastSpinAtMs + delayMs : null;
  }
  function canPlaceIce2fBet(recovery, lastSpinAtMs, nowMs = Date.now()) {
    if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
    return nowMs - lastSpinAtMs >= ice2fBetDelayMs(recovery);
  }
  function tickIce2fPlacar(historyNewestFirst, machine, stats, maxRecovery = ICE_2F_MAX_RECOVERY) {
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
        const rebuilt = ice2fBuildActiveFromHistory(
          historyNewestFirst,
          nextMachine.cycle.active.criticalPosition,
          nextMachine.cycle.active.axis
        );
        if (!rebuilt) {
          nextMachine = {
            ...nextMachine,
            cycle: {
              ...nextMachine.cycle,
              phase: "awaiting_reference",
              armedHead: head
            }
          };
        } else {
          nextMachine = {
            ...nextMachine,
            cycle: {
              ...nextMachine.cycle,
              active: rebuilt,
              armedHead: head,
              phase: "awaiting_bet"
            }
          };
        }
      }
    }
    if (nextMachine.cycle?.phase === "awaiting_reference" && headChanged && nextMachine.cycle.armedHead !== head) {
      nextMachine = {
        ...nextMachine,
        cycle: ice2fResumeCycleAfterRebuild(
          nextMachine.cycle,
          historyNewestFirst,
          head
        )
      };
    }
    if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
      const cycle = nextMachine.cycle;
      const resultNumber = historyNewestFirst[0];
      const outcome = ice2fClassifyBetRound(resultNumber, cycle.active);
      const { active, recovery } = cycle;
      if (outcome === "W") {
        nextStats = recordRotatingRoomSessionWin(nextStats, recovery, maxRecovery);
        statsChanged = true;
        nextMachine = {
          ...nextMachine,
          cycle: null,
          betCommitInFlight: false
        };
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
        nextMachine = {
          ...nextMachine,
          betCommitInFlight: false,
          cycle: ice2fResumeCycleAfterRebuild(cycle, historyNewestFirst, head)
        };
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
        const nextRecovery = recovery + 1;
        if (nextRecovery > maxRecovery) {
          nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recovery, maxRecovery);
          statsChanged = true;
          nextMachine = {
            ...nextMachine,
            cycle: null,
            betCommitInFlight: false
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
          nextMachine = {
            ...nextMachine,
            betCommitInFlight: false,
            cycle: ice2fResumeCycleAfterRebuild(
              { ...cycle, recovery: nextRecovery },
              historyNewestFirst,
              head
            )
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
        }
      }
    }
    if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= ICE_2F_MIN_HISTORY) {
      nextMachine = {
        ...nextMachine,
        watch: updateWatchOnSpin(nextMachine.watch, historyNewestFirst)
      };
      nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
    }
    if (nextMachine.cycle && headChanged) {
      const armed = firstArmedSlot(nextMachine.watch);
      if (armed != null && (armed.position !== nextMachine.cycle.active.criticalPosition || armed.axis !== nextMachine.cycle.active.axis)) {
        nextMachine = { ...nextMachine, pendingArm: armed };
      }
    }
    if (!nextMachine.cycle && nextMachine.pendingArm != null && headChanged) {
      const { position, axis } = nextMachine.pendingArm;
      if (ice2fIsWatchSlotArmed(nextMachine.watch[position][axis])) {
        nextMachine = tryArmCycleFromWatch(nextMachine, historyNewestFirst, head);
        if (nextMachine.cycle) {
          nextMachine = { ...nextMachine, pendingArm: null };
        }
      }
    }
    if (nextMachine.cycle?.phase === "awaiting_bet") {
      const rebuilt = ice2fBuildActiveFromHistory(
        historyNewestFirst,
        nextMachine.cycle.active.criticalPosition,
        nextMachine.cycle.active.axis
      );
      if (!rebuilt) {
        nextMachine = {
          ...nextMachine,
          cycle: {
            ...nextMachine.cycle,
            phase: "awaiting_reference",
            armedHead: head
          }
        };
      }
    }
    const globalActive = nextMachine.cycle?.phase === "awaiting_bet" ? nextMachine.cycle.active : null;
    const globalRecovery = nextMachine.cycle?.recovery ?? 0;
    return {
      machine: nextMachine,
      stats: nextStats,
      statsChanged,
      flash,
      globalActive,
      globalRecovery
    };
  }
  function parseIce2fStats(raw, maxRecovery = ICE_2F_MAX_RECOVERY) {
    return parseRotatingRoomSessionStats(raw, maxRecovery);
  }
  function emptyIce2fStats(maxRecovery = ICE_2F_MAX_RECOVERY) {
    return emptyRotatingRoomSessionStats(maxRecovery);
  }
  function formatIce2fWatchLabel(watch) {
    const parts = [];
    for (const pos of ICE_2F_CRITICAL_POSITIONS) {
      for (const axis of ICE_2F_CROSSING_AXES) {
        const f = watch[pos][axis].failures;
        const short = axis === "cor-altura" ? "c/a" : "p/a";
        parts.push(`${pos}${short}:${f}/${ICE_2F_REQUIRED_FAILURES}`);
      }
    }
    return parts.join(" \xB7 ");
  }

  // extension-kto-cruzamento-2f/kto2f-strategy-entry.ts
  var KTO2F_TABLE_ID = 230;
  var KTO2F_MESA_URL = "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/";
  var KTO2F_MAX_GALES = ICE_2F_MAX_RECOVERY;
  var ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_2F_FIRST_BET_SETTLE_MS;
  var ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_2F_RECOVERY_BET_DELAY_MS;
  var BASE_STAKE = 0.5;
  function clampMaxRecovery(value, fallback = ICE_2F_MAX_RECOVERY) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback));
    return Math.min(ICE_2F_MAX_RECOVERY, Math.max(0, Math.floor(n)));
  }
  function createKto2fEngine(options = {}) {
    const maxRecovery = clampMaxRecovery(options.maxRecovery);
    let machine = defaultIce2fMachineState();
    if (options.initialMachine?.lastSpinHead) {
      machine = { ...machine, lastSpinHead: options.initialMachine.lastSpinHead };
    }
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
      machine = {
        ...defaultIce2fMachineState(),
        watch,
        lastSpinHead: head
      };
      if (history.length >= 12) {
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
      return canPlaceIce2fBet(machine.cycle.recovery, lastLiveSpinAt, nowMs);
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
    function buildBridgePayload(mesaEmbedUrl = KTO2F_MESA_URL) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
      if (!canPlaceBet()) return null;
      const { active, recovery } = machine.cycle;
      const units = ice2fStakeUnits(recovery);
      const signalId = `kto2f:pos${active.criticalPosition}:${active.axis}:ref${active.referenceNumber}:r${recovery}`;
      const f1Key = pragmaticExteriorBetKeyFromFactor(active.factor1);
      const f2Key = pragmaticExteriorBetKeyFromFactor(active.factor2);
      const f1Label = doisFatoresFactorLabel(active.factor1);
      const f2Label = doisFatoresFactorLabel(active.factor2);
      const stakeAmount = BASE_STAKE * units;
      const betDelayUntilMs = ice2fBetDelayUntilMs(recovery, lastLiveSpinAt);
      const galeSuffix = recovery > 0 ? ` \xB7 gale ${recovery}` : " \xB7 entrada";
      return {
        type: "game-odds-glow/rotating-room-extension",
        version: 1,
        fingerprint: signalId,
        actions: [
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
        ],
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
      }
    };
  }
  var api = {
    KTO2F_TABLE_ID,
    KTO2F_MESA_URL,
    KTO2F_MAX_GALES,
    ICE_2F_BET_DELAY_MS,
    ICE_2F_FIRST_BET_SETTLE_MS,
    ICE_2F_MAX_RECOVERY,
    ICE_2F_RECOVERY_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    formatIce2fWatchLabel,
    ice2fBetDelayMs,
    ice2fBetDelayUntilMs,
    ice2fPadFactorPlacementMs,
    createKto2fEngine
  };
  if (typeof globalThis !== "undefined") {
    globalThis.SinglestakeKto2f = api;
  }
  var kto2f_strategy_entry_default = api;
  return __toCommonJS(kto2f_strategy_entry_exports);
})();
