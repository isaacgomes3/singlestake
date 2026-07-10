"use strict";
var SinglestakeKtoCruzamento = (() => {
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

  // extension-kto/kto-strategy-entry.ts
  var kto_strategy_entry_exports = {};
  __export(kto_strategy_entry_exports, {
    KTO_MAX_GALES: () => KTO_MAX_GALES,
    KTO_MESA_URL: () => KTO_MESA_URL,
    KTO_TABLE_ID: () => KTO_TABLE_ID,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS: () => ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS: () => ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    createKtoCruzamentoEngine: () => createKtoCruzamentoEngine,
    default: () => kto_strategy_entry_default
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
  function dozenOf(n) {
    if (n === 0) return null;
    if (n <= 12) return 1;
    if (n <= 24) return 2;
    return 3;
  }
  function differentDozens(a, b) {
    const d1 = dozenOf(a);
    const d2 = dozenOf(b);
    return d1 != null && d2 != null && d1 !== d2;
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
  function umFatorOppositeFactor(f) {
    return oppositeFactor(f);
  }
  function umFatorSharedFactorsBetween(a, b) {
    if (a === 0 || b === 0) return [];
    const triple = umFatorTripleFactorsForNumber(a);
    if (!triple) return [];
    return triple.filter((f) => factorWins2(b, f));
  }

  // src/lib/roulette/ktoCruzamentoSequencialStrategy.ts
  var KTO_ROULETTE_TABLE_ID = 230;
  var KTO_ROULETTE_MESA_URL = "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/";
  var KTO_CRUZAMENTO_MAX_RECOVERY = 6;
  var KTO_CRUZAMENTO_MIN_HISTORY = 2;
  var KTO_CRUZAMENTO_STAKE_UNITS = [1, 1, 2, 4, 8, 16, 32];
  var KTO_CRUZAMENTO_FIRST_BET_SETTLE_MS = 6e3;
  var KTO_CRUZAMENTO_RECOVERY_BET_DELAY_MS = 6e3;
  var KTO_OPPOSITE_RECOVERIES = /* @__PURE__ */ new Set([1, 4, 5]);
  function ktoCruzamentoStakeUnits(recovery) {
    const idx = Math.min(
      Math.max(0, Math.floor(recovery)),
      KTO_CRUZAMENTO_STAKE_UNITS.length - 1
    );
    return KTO_CRUZAMENTO_STAKE_UNITS[idx];
  }
  function sameTriggerPair(a, b) {
    if (!a || !b) return false;
    return a[0] === b[0] && a[1] === b[1] || a[0] === b[1] && a[1] === b[0];
  }
  function pairKindFromFactors(f1, f2) {
    const kinds = /* @__PURE__ */ new Set([f1.kind, f2.kind]);
    if (kinds.has("cor") && kinds.has("altura")) return "cor-altura";
    if (kinds.has("cor") && kinds.has("paridade")) return "cor-paridade";
    return "altura-paridade";
  }
  function spinHead(history) {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }
  function toTapeteActive(active, factor1, factor2) {
    return {
      pairKind: active.pairKind,
      pairKindLabel: "Cruzamento sequencial",
      patternMode: "convergence",
      patternStats: { convergence: 0, divergence: 0, alternation: 0, safetyMode: false },
      referenceNumber: active.triggerNumbers[0],
      factor1,
      factor2,
      triggerNumbers: active.triggerNumbers,
      armingDescription: active.armingDescription
    };
  }
  function ktoCruzamentoUseOppositeFactors(recovery) {
    return KTO_OPPOSITE_RECOVERIES.has(recovery);
  }
  function ktoCruzamentoBetFactors(active, recovery) {
    if (!ktoCruzamentoUseOppositeFactors(recovery)) {
      return { factor1: active.factor1, factor2: active.factor2, oppositeMode: false };
    }
    return {
      factor1: umFatorOppositeFactor(active.factor1),
      factor2: umFatorOppositeFactor(active.factor2),
      oppositeMode: true
    };
  }
  function detectKtoCruzamentoTrigger(historyNewestFirst) {
    if (historyNewestFirst.length < KTO_CRUZAMENTO_MIN_HISTORY) return null;
    const n0 = historyNewestFirst[0];
    const n1 = historyNewestFirst[1];
    if (n0 === 0 || n1 === 0) return null;
    if (!differentDozens(n0, n1)) return null;
    if (umFatorTriggerMatchCount(n0, n1) !== 2) return null;
    const shared = umFatorSharedFactorsBetween(n0, n1);
    if (shared.length !== 2) return null;
    const factor1 = shared[0];
    const factor2 = shared[1];
    const label = shared.map(doisFatoresFactorLabel).join(" \xB7 ");
    return {
      factor1,
      factor2,
      pairKind: pairKindFromFactors(factor1, factor2),
      triggerNumbers: [n1, n0],
      armingDescription: `KTO 2F: cruzamento ${label} (${n1}, ${n0}) \u2192 entrada nos 2 factores`
    };
  }
  function evaluateKtoCruzamentoRound(num, active, recovery) {
    const { factor1, factor2 } = ktoCruzamentoBetFactors(active, recovery);
    return evaluateDoisFatoresRound(num, toTapeteActive(active, factor1, factor2));
  }
  function defaultKtoCruzamentoMachineState() {
    return {
      cycle: null,
      lastSpinHead: null,
      recovery: 0,
      lastEndedTriggerPair: null,
      lastEndedAtHead: null
    };
  }
  function ktoCruzamentoBetDelayMs(recovery) {
    return recovery > 0 ? KTO_CRUZAMENTO_RECOVERY_BET_DELAY_MS : KTO_CRUZAMENTO_FIRST_BET_SETTLE_MS;
  }
  function canPlaceKtoCruzamentoBet(recovery, lastSpinAtMs, nowMs = Date.now()) {
    if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
    return nowMs - lastSpinAtMs >= ktoCruzamentoBetDelayMs(recovery);
  }
  function tickKtoCruzamentoPlacar(historyNewestFirst, machine, stats, maxRecovery = KTO_CRUZAMENTO_MAX_RECOVERY) {
    const head = spinHead(historyNewestFirst);
    const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
    let nextMachine = {
      ...machine,
      lastSpinHead: head,
      recovery: machine.recovery ?? 0
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
      const { active, recovery } = nextMachine.cycle;
      const resultNumber = historyNewestFirst[0];
      const outcome = evaluateKtoCruzamentoRound(resultNumber, active, recovery);
      const bet = ktoCruzamentoBetFactors(active, recovery);
      if (outcome === "W") {
        nextStats = recordRotatingRoomSessionWin(nextStats, recovery, maxRecovery);
        statsChanged = true;
        nextMachine = {
          ...nextMachine,
          cycle: null,
          recovery: 0,
          betCommitInFlight: false,
          lastEndedTriggerPair: active.triggerNumbers,
          lastEndedAtHead: head
        };
        flash = {
          resultNumber,
          won: true,
          tableId: KTO_ROULETTE_TABLE_ID,
          kind: "win",
          factor1: bet.factor1,
          factor2: bet.factor2,
          recovery,
          triggerNumbers: active.triggerNumbers,
          oppositeMode: bet.oppositeMode
        };
      } else if (outcome === "continue") {
        nextMachine = {
          ...nextMachine,
          cycle: null,
          recovery,
          lastEndedTriggerPair: active.triggerNumbers,
          lastEndedAtHead: head
        };
        flash = {
          resultNumber,
          won: false,
          tableId: KTO_ROULETTE_TABLE_ID,
          kind: "tie",
          factor1: bet.factor1,
          factor2: bet.factor2,
          recovery,
          triggerNumbers: active.triggerNumbers,
          oppositeMode: bet.oppositeMode
        };
      } else {
        const recoveryBefore = recovery;
        const nextRecovery = recoveryBefore + 1;
        if (nextRecovery > maxRecovery) {
          nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recoveryBefore, maxRecovery);
          statsChanged = true;
          nextMachine = {
            ...nextMachine,
            cycle: null,
            recovery: 0,
            lastEndedTriggerPair: active.triggerNumbers,
            lastEndedAtHead: head
          };
          flash = {
            resultNumber,
            won: false,
            tableId: KTO_ROULETTE_TABLE_ID,
            kind: "loss",
            factor1: bet.factor1,
            factor2: bet.factor2,
            recovery: recoveryBefore,
            triggerNumbers: active.triggerNumbers,
            oppositeMode: bet.oppositeMode
          };
        } else {
          nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recoveryBefore, maxRecovery);
          statsChanged = true;
          nextMachine = {
            ...nextMachine,
            cycle: null,
            recovery: nextRecovery,
            lastEndedTriggerPair: active.triggerNumbers,
            lastEndedAtHead: head
          };
          flash = {
            resultNumber,
            won: false,
            tableId: KTO_ROULETTE_TABLE_ID,
            kind: "loss",
            factor1: bet.factor1,
            factor2: bet.factor2,
            recovery: recoveryBefore,
            triggerNumbers: active.triggerNumbers,
            oppositeMode: bet.oppositeMode
          };
        }
      }
    }
    if (!nextMachine.cycle && headChanged) {
      const trigger = detectKtoCruzamentoTrigger(historyNewestFirst);
      const suppressPair = nextMachine.lastEndedAtHead === head ? nextMachine.lastEndedTriggerPair : null;
      const blocked = trigger != null && suppressPair != null && sameTriggerPair(trigger.triggerNumbers, suppressPair);
      if (trigger && !blocked) {
        const armedRecovery = nextMachine.recovery ?? 0;
        nextMachine = {
          ...nextMachine,
          cycle: {
            active: trigger,
            armedHead: head,
            recovery: armedRecovery,
            phase: "awaiting_bet"
          }
        };
      } else if (head !== nextMachine.lastEndedAtHead) {
        nextMachine = {
          ...nextMachine,
          lastEndedTriggerPair: null,
          lastEndedAtHead: null
        };
      }
    }
    const globalActive = nextMachine.cycle?.phase === "awaiting_bet" ? nextMachine.cycle.active : null;
    const globalRecovery = nextMachine.cycle?.recovery ?? nextMachine.recovery ?? 0;
    return {
      machine: nextMachine,
      stats: nextStats,
      statsChanged,
      flash,
      globalActive,
      globalRecovery
    };
  }
  function parseKtoCruzamentoStats(raw, maxRecovery = KTO_CRUZAMENTO_MAX_RECOVERY) {
    return parseRotatingRoomSessionStats(raw, maxRecovery);
  }
  function emptyKtoCruzamentoStats(maxRecovery = KTO_CRUZAMENTO_MAX_RECOVERY) {
    return emptyRotatingRoomSessionStats(maxRecovery);
  }

  // extension-kto/kto-strategy-entry.ts
  var KTO_TABLE_ID = KTO_ROULETTE_TABLE_ID;
  var KTO_MESA_URL = KTO_ROULETTE_MESA_URL;
  var KTO_MAX_GALES = KTO_CRUZAMENTO_MAX_RECOVERY;
  var ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = KTO_CRUZAMENTO_FIRST_BET_SETTLE_MS;
  var ROTATING_ROOM_CROSSING_BET_DELAY_MS = KTO_CRUZAMENTO_RECOVERY_BET_DELAY_MS;
  var BASE_STAKE = 0.5;
  function clampMaxRecovery(value, fallback = KTO_CRUZAMENTO_MAX_RECOVERY) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback));
    return Math.min(KTO_CRUZAMENTO_MAX_RECOVERY, Math.max(0, Math.floor(n)));
  }
  function stakeForRecovery(recovery, maxRecovery) {
    const level = Math.min(Math.max(0, recovery), maxRecovery, KTO_CRUZAMENTO_STAKE_UNITS.length - 1);
    return BASE_STAKE * ktoCruzamentoStakeUnits(level);
  }
  function createKtoCruzamentoEngine(options = {}) {
    const maxRecovery = clampMaxRecovery(options.maxRecovery);
    let machine = defaultKtoCruzamentoMachineState();
    if (options.initialMachine) {
      machine = {
        ...machine,
        recovery: typeof options.initialMachine.recovery === "number" && Number.isFinite(options.initialMachine.recovery) ? Math.max(0, Math.floor(options.initialMachine.recovery)) : 0,
        lastSpinHead: typeof options.initialMachine.lastSpinHead === "string" ? options.initialMachine.lastSpinHead : null
      };
    }
    let stats = options.initialStats != null ? parseKtoCruzamentoStats(options.initialStats, maxRecovery) : emptyKtoCruzamentoStats(maxRecovery);
    let history = [];
    let lastGameId = null;
    let spinBaselined = false;
    let liveSpinSeen = false;
    let lastLiveSpinAt = null;
    function spinHead2() {
      if (history.length === 0) return "0";
      return `${history.length}:${history[0]}`;
    }
    function anchorSpinClock() {
      lastLiveSpinAt = Date.now();
    }
    function runTick() {
      const tick = tickKtoCruzamentoPlacar(history, machine, stats, maxRecovery);
      machine = tick.machine;
      stats = tick.stats;
      return {
        active: tick.globalActive,
        recovery: tick.globalRecovery,
        machine,
        stats,
        flash: tick.flash
      };
    }
    function ingestHistorySnapshot(spins) {
      if (liveSpinSeen) return null;
      history = spins.map((s) => s.number);
      if (spins[0]) {
        lastGameId = spins[0].gameId;
        spinBaselined = true;
      }
      machine = { ...machine, lastSpinHead: spinHead2() };
      return {
        active: null,
        recovery: 0,
        machine,
        stats,
        flash: null
      };
    }
    function ingestSpin(number, gameId, replay = false) {
      const prefixed = gameId;
      if (!spinBaselined) {
        lastGameId = prefixed;
        spinBaselined = true;
      }
      if (lastGameId === prefixed && !replay) return null;
      lastGameId = prefixed;
      liveSpinSeen = true;
      anchorSpinClock();
      history.unshift(number);
      if (history.length > 40) history.length = 40;
      return runTick();
    }
    function canPlaceBet(nowMs = Date.now()) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
      return canPlaceKtoCruzamentoBet(machine.cycle.recovery, lastLiveSpinAt, nowMs);
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
    function buildBridgePayload(mesaEmbedUrl = KTO_MESA_URL) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
      if (!canPlaceBet()) return null;
      const { active, recovery } = machine.cycle;
      const bet = ktoCruzamentoBetFactors(active, recovery);
      const modeTag = bet.oppositeMode ? "opp" : "norm";
      const signalId = `kto:${active.triggerNumbers.join("-")}:${recovery}:${modeTag}`;
      const f1Key = pragmaticExteriorBetKeyFromFactor(bet.factor1);
      const f2Key = pragmaticExteriorBetKeyFromFactor(bet.factor2);
      const f1Label = doisFatoresFactorLabel(bet.factor1);
      const f2Label = doisFatoresFactorLabel(bet.factor2);
      const stakeAmount = stakeForRecovery(recovery, maxRecovery);
      const units = ktoCruzamentoStakeUnits(recovery);
      const betDelayUntilMs = lastLiveSpinAt != null ? lastLiveSpinAt + (recovery > 0 ? KTO_CRUZAMENTO_RECOVERY_BET_DELAY_MS : KTO_CRUZAMENTO_FIRST_BET_SETTLE_MS) : null;
      const galeSuffix = recovery > 0 ? ` \xB7 gale ${recovery}` : " \xB7 entrada";
      const modeSuffix = bet.oppositeMode ? " \xB7 oposto" : "";
      const unitsSuffix = ` \xB7 ${units} un.`;
      return {
        type: "game-odds-glow/rotating-room-extension",
        version: 1,
        fingerprint: signalId,
        actions: [
          {
            kind: "click",
            target: "factor-1",
            label: f1Label,
            reason: `KTO 2F \xB7 ${f1Label}${galeSuffix}${modeSuffix}${unitsSuffix}`
          },
          {
            kind: "click",
            target: "factor-2",
            label: f2Label,
            reason: `KTO 2F \xB7 ${f2Label}${galeSuffix}${modeSuffix}${unitsSuffix}`
          }
        ],
        context: {
          sessionMode: "active",
          prepareTableId: null,
          currentTableId: KTO_TABLE_ID,
          mesaEmbedUrl: mesaEmbedUrl ?? KTO_MESA_URL,
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
          strategy: "dois2fatores",
          rotativaTrigger: "crossing",
          betDelayUntilMs,
          mesaCatalog: []
        }
      };
    }
    return {
      tableId: KTO_TABLE_ID,
      ingestHistorySnapshot,
      ingestSpin,
      runTick,
      buildBridgePayload,
      canPlaceBet,
      beginBetCommit,
      abortBetCommit,
      markBetPlaced,
      getState: () => ({ machine, stats, history, lastLiveSpinAt, maxRecovery }),
      resetStats() {
        stats = emptyKtoCruzamentoStats(maxRecovery);
      },
      reset() {
        machine = defaultKtoCruzamentoMachineState();
        stats = emptyKtoCruzamentoStats(maxRecovery);
        history = [];
        lastGameId = null;
        spinBaselined = false;
        liveSpinSeen = false;
        lastLiveSpinAt = null;
      }
    };
  }
  var api = {
    KTO_TABLE_ID,
    KTO_MESA_URL,
    KTO_MAX_GALES,
    KTO_CRUZAMENTO_STAKE_UNITS,
    ktoCruzamentoStakeUnits,
    ktoCruzamentoBetFactors,
    ktoCruzamentoUseOppositeFactors,
    createKtoCruzamentoEngine
  };
  if (typeof globalThis !== "undefined") {
    globalThis.SinglestakeKtoCruzamento = api;
  }
  var kto_strategy_entry_default = api;
  return __toCommonJS(kto_strategy_entry_exports);
})();
