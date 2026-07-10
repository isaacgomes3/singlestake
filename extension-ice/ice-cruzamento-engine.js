"use strict";
var SinglestakeIceCruzamento = (() => {
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

  // extension-ice/ice-strategy-entry.ts
  var ice_strategy_entry_exports = {};
  __export(ice_strategy_entry_exports, {
    ICE_MAX_GALES: () => ICE_MAX_GALES,
    ICE_MESA_URL: () => ICE_MESA_URL,
    ICE_TABLE_ID: () => ICE_TABLE_ID,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS: () => ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS: () => ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    createIceCruzamentoEngine: () => createIceCruzamentoEngine,
    default: () => ice_strategy_entry_default
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
  function columnOf(n) {
    if (n === 0) return null;
    return (n - 1) % 3 + 1;
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
  function umFatorOppositeFactor(f) {
    return oppositeFactor(f);
  }
  function umFatorSharedFactorsBetween(a, b) {
    if (a === 0 || b === 0) return [];
    const triple = umFatorTripleFactorsForNumber(a);
    if (!triple) return [];
    return triple.filter((f) => factorWins(b, f));
  }

  // src/lib/roulette/ktoCruzamentoSequencialStrategy.ts
  var KTO_CRUZAMENTO_MIN_HISTORY = 2;
  function pairKindFromFactors(f1, f2) {
    const kinds = /* @__PURE__ */ new Set([f1.kind, f2.kind]);
    if (kinds.has("cor") && kinds.has("altura")) return "cor-altura";
    if (kinds.has("cor") && kinds.has("paridade")) return "cor-paridade";
    return "altura-paridade";
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

  // src/lib/roulette/iceDuziaEvolutionStrategy.ts
  var ICE_ROULETTE_TABLE_ID = 201;
  var ICE_ROULETTE_MESA_URL = "https://ice.bet.br/games/tag/roulette/liveroulettea-pragmaticexternal";
  var ICE_DUZIA_FIBONACCI_UNITS = [1, 1, 2, 3, 5, 8, 13, 21, 34];
  var ICE_DUZIA_MAX_RECOVERY = ICE_DUZIA_FIBONACCI_UNITS.length - 1;
  var ICE_DUZIA_INITIAL_UNITS = ICE_DUZIA_FIBONACCI_UNITS[0];
  var ICE_DUZIA_FIRST_BET_SETTLE_MS = 5e3;
  var ICE_DUZIA_BET_DELAY_MS = 5e3;
  var ICE_DOZEN_BASE_UNITS = 12;
  var ICE_COVERED_NUMBER_COUNT = 11;
  var ICE_EXCLUDE_COUNT = 2;
  var ICE_HISTORY_PROTECT_WINDOW = 12;
  function sameTriggerPair(a, b) {
    if (!a || !b) return false;
    return a[0] === b[0] && a[1] === b[1] || a[0] === b[1] && a[1] === b[0];
  }
  function spinHead(history) {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
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
  function iceDuziaLabel(d) {
    return `${d}\xAA d\xFAzia`;
  }
  function iceDuziaBetKey(d) {
    return `doz:${d}`;
  }
  function iceNumberBetKey(n) {
    return `num:${n}`;
  }
  function iceDuziaClampRecovery(recovery) {
    const n = Math.floor(recovery);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(ICE_DUZIA_MAX_RECOVERY, n);
  }
  function iceDuziaUnitsForRecovery(recovery) {
    const idx = iceDuziaClampRecovery(recovery);
    return ICE_DUZIA_FIBONACCI_UNITS[idx];
  }
  function iceDuziaRecoveryAfterResult(recovery, won) {
    if (won) return 0;
    return iceDuziaClampRecovery(iceDuziaClampRecovery(recovery) + 1);
  }
  function iceMissingDozen(a, b) {
    const d0 = dozenOf(a);
    const d1 = dozenOf(b);
    if (d0 == null || d1 == null || d0 === d1) return null;
    for (const d of [1, 2, 3]) {
      if (d !== d0 && d !== d1) return d;
    }
    return null;
  }
  function iceNumbersInDozen(dozen) {
    const start = (dozen - 1) * 12 + 1;
    return Array.from({ length: 12 }, (_, i) => start + i);
  }
  function matchesBothFactors(n, f1, f2) {
    return factorWins2(n, f1) && factorWins2(n, f2);
  }
  function shuffleInPlace(arr, random) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
  function icePickExcludedNumbers(missingDozen, opposite1, opposite2, historyNewestFirst, triggerNumbers, random = Math.random) {
    const inDozen = iceNumbersInDozen(missingDozen);
    const recent = new Set(
      historyNewestFirst.slice(0, ICE_HISTORY_PROTECT_WINDOW).filter((n) => n > 0)
    );
    const triggerColumns = new Set(
      [columnOf(triggerNumbers[0]), columnOf(triggerNumbers[1])].filter(
        (c) => c != null
      )
    );
    const isBlocked = (n) => {
      if (recent.has(n)) return true;
      const col = columnOf(n);
      return col != null && triggerColumns.has(col);
    };
    const oppositeEligible = inDozen.filter(
      (n) => matchesBothFactors(n, opposite1, opposite2) && !isBlocked(n)
    );
    const dozenEligible = inDozen.filter((n) => !isBlocked(n));
    const pool = oppositeEligible.length >= ICE_EXCLUDE_COUNT ? oppositeEligible : dozenEligible;
    if (pool.length < ICE_EXCLUDE_COUNT) return null;
    const shuffled = shuffleInPlace([...pool], random);
    const a = shuffled[0];
    const b = shuffled[1];
    return a < b ? [a, b] : [b, a];
  }
  function iceBuildCoveredNumbers(missingDozen, excluded) {
    const exclude = new Set(excluded);
    const fromMissing = iceNumbersInDozen(missingDozen).filter((n) => !exclude.has(n));
    return [0, ...fromMissing];
  }
  function detectIceDuziaTrigger(historyNewestFirst, random = Math.random) {
    const trigger = detectKtoCruzamentoTrigger(historyNewestFirst);
    if (!trigger) return null;
    const n0 = historyNewestFirst[0];
    const n1 = historyNewestFirst[1];
    const d0 = dozenOf(n0);
    const d1 = dozenOf(n1);
    const missing = iceMissingDozen(n0, n1);
    if (d0 == null || d1 == null || missing == null) return null;
    const shared = umFatorSharedFactorsBetween(n0, n1);
    if (shared.length !== 2) return null;
    const opposite1 = umFatorOppositeFactor(shared[0]);
    const opposite2 = umFatorOppositeFactor(shared[1]);
    const excluded = icePickExcludedNumbers(
      missing,
      opposite1,
      opposite2,
      historyNewestFirst,
      [n1, n0],
      random
    );
    if (!excluded) return null;
    const coveredNumbers = iceBuildCoveredNumbers(missing, excluded);
    const dozen1 = Math.min(d0, d1);
    const dozen2 = Math.max(d0, d1);
    return {
      dozen1,
      dozen2,
      missingDozen: missing,
      coveredNumbers,
      excludedNumbers: excluded,
      oppositeFactors: [opposite1, opposite2],
      triggerNumbers: [n1, n0],
      armingDescription: `ICE cobertura ${iceDuziaLabel(dozen1)}+${iceDuziaLabel(dozen2)} \xB7 ${coveredNumbers.length} n\xFAms \xB7 excl ${excluded.join(",")}`
    };
  }
  function evaluateIceDuziaRound(num, active) {
    if (num === 0) return "W";
    const d = dozenOf(num);
    if (d === active.dozen1 || d === active.dozen2) return "W";
    if (active.coveredNumbers.includes(num)) return "W";
    return "L";
  }
  function defaultIceDuziaMachineState() {
    return {
      cycle: null,
      lastSpinHead: null,
      recovery: 0,
      lastBetUnits: null,
      lastEndedTriggerPair: null,
      lastEndedAtHead: null
    };
  }
  function emptyIceDuziaStats() {
    return { wins: 0, losses: 0 };
  }
  function parseIceDuziaStats(raw) {
    const o = raw ?? {};
    return {
      wins: Math.max(0, Number(o.wins) || 0),
      losses: Math.max(0, Number(o.losses) || 0)
    };
  }
  function iceDuziaBetDelayMs(recovery) {
    return iceDuziaClampRecovery(recovery) > 0 ? ICE_DUZIA_BET_DELAY_MS : ICE_DUZIA_FIRST_BET_SETTLE_MS;
  }
  function canPlaceIceDuziaBet(recovery, lastSpinAtMs, nowMs = Date.now()) {
    if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
    return nowMs - lastSpinAtMs >= iceDuziaBetDelayMs(recovery);
  }
  function iceStakePlanForRecovery(recovery) {
    const unitScale = iceDuziaUnitsForRecovery(recovery);
    const dozenUnits = ICE_DOZEN_BASE_UNITS * unitScale;
    const numberUnits = unitScale;
    return {
      unitScale,
      dozenUnits,
      numberUnits,
      totalUnits: dozenUnits * 2 + numberUnits * ICE_COVERED_NUMBER_COUNT
    };
  }
  function tickIceDuziaPlacar(historyNewestFirst, machine, stats) {
    const head = spinHead(historyNewestFirst);
    const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
    let nextMachine = {
      ...machine,
      lastSpinHead: head,
      recovery: iceDuziaClampRecovery(machine.recovery ?? 0)
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
      const { active, dozenUnits, recovery } = nextMachine.cycle;
      const resultNumber = historyNewestFirst[0];
      const won = evaluateIceDuziaRound(resultNumber, active) === "W";
      const nextRecovery = iceDuziaRecoveryAfterResult(recovery, won);
      const nextUnits = iceDuziaUnitsForRecovery(nextRecovery);
      const betUnits = dozenUnits;
      if (won) {
        nextStats = { ...nextStats, wins: nextStats.wins + 1 };
        statsChanged = true;
      } else {
        nextStats = { ...nextStats, losses: nextStats.losses + 1 };
        statsChanged = true;
      }
      nextMachine = {
        ...nextMachine,
        cycle: null,
        recovery: nextRecovery,
        lastBetUnits: betUnits,
        betCommitInFlight: false,
        lastEndedTriggerPair: active.triggerNumbers,
        lastEndedAtHead: head
      };
      flash = {
        resultNumber,
        won,
        kind: won ? "win" : "loss",
        betUnits,
        recovery,
        nextRecovery,
        nextUnits,
        triggerNumbers: active.triggerNumbers,
        dozen1: active.dozen1,
        dozen2: active.dozen2,
        coveredNumbers: active.coveredNumbers
      };
    }
    if (!nextMachine.cycle && headChanged) {
      const trigger = detectIceDuziaTrigger(historyNewestFirst);
      const suppressPair = nextMachine.lastEndedAtHead === head ? nextMachine.lastEndedTriggerPair : null;
      const blocked = trigger != null && suppressPair != null && sameTriggerPair(trigger.triggerNumbers, suppressPair);
      if (trigger && !blocked) {
        const recovery = nextMachine.recovery;
        const plan = iceStakePlanForRecovery(recovery);
        nextMachine = {
          ...nextMachine,
          cycle: {
            active: trigger,
            armedHead: head,
            recovery,
            unitScale: plan.unitScale,
            dozenUnits: plan.dozenUnits,
            numberUnits: plan.numberUnits,
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
    const globalRecovery = nextMachine.cycle?.recovery ?? nextMachine.recovery;
    const globalUnits = nextMachine.cycle?.dozenUnits ?? iceStakePlanForRecovery(globalRecovery).dozenUnits;
    return {
      machine: nextMachine,
      stats: nextStats,
      statsChanged,
      flash,
      globalActive,
      globalUnits,
      globalRecovery
    };
  }

  // extension-ice/ice-strategy-entry.ts
  var ICE_TABLE_ID = ICE_ROULETTE_TABLE_ID;
  var ICE_MESA_URL = ICE_ROULETTE_MESA_URL;
  var ICE_MAX_GALES = ICE_DUZIA_MAX_RECOVERY;
  var ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = ICE_DUZIA_FIRST_BET_SETTLE_MS;
  var ROTATING_ROOM_CROSSING_BET_DELAY_MS = ICE_DUZIA_BET_DELAY_MS;
  var BASE_STAKE = 0.5;
  function recoveryFromLegacyUnits(units) {
    const u = Math.max(1, Math.floor(units));
    if (u === 1) return 0;
    if (u === ICE_DOZEN_BASE_UNITS) return 0;
    const scale = Math.max(1, Math.round(u / ICE_DOZEN_BASE_UNITS));
    const idx = ICE_DUZIA_FIBONACCI_UNITS.indexOf(
      scale
    );
    if (idx >= 0) return idx;
    for (let i = ICE_DUZIA_FIBONACCI_UNITS.length - 1; i >= 0; i--) {
      if (ICE_DUZIA_FIBONACCI_UNITS[i] <= scale) return i;
    }
    return 0;
  }
  function createIceCruzamentoEngine(options = {}) {
    let machine = defaultIceDuziaMachineState();
    if (options.initialMachine) {
      const recovery = typeof options.initialMachine.recovery === "number" && Number.isFinite(options.initialMachine.recovery) ? iceDuziaClampRecovery(options.initialMachine.recovery) : typeof options.initialMachine.units === "number" && Number.isFinite(options.initialMachine.units) ? recoveryFromLegacyUnits(options.initialMachine.units) : 0;
      machine = {
        ...machine,
        recovery,
        lastBetUnits: typeof options.initialMachine.lastBetUnits === "number" && Number.isFinite(options.initialMachine.lastBetUnits) ? Math.max(1, Math.floor(options.initialMachine.lastBetUnits)) : null,
        lastSpinHead: typeof options.initialMachine.lastSpinHead === "string" ? options.initialMachine.lastSpinHead : null
      };
    }
    let stats = options.initialStats != null ? parseIceDuziaStats(options.initialStats) : emptyIceDuziaStats();
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
      const tick = tickIceDuziaPlacar(history, machine, stats);
      machine = tick.machine;
      stats = tick.stats;
      return {
        active: tick.globalActive,
        units: tick.globalUnits,
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
      const plan = iceStakePlanForRecovery(machine.recovery);
      return {
        active: null,
        units: plan.dozenUnits,
        recovery: machine.recovery,
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
      return canPlaceIceDuziaBet(machine.cycle.recovery, lastLiveSpinAt, nowMs);
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
        lastBetUnits: machine.cycle.dozenUnits,
        cycle: { ...machine.cycle, phase: "awaiting_result" }
      };
    }
    function buildBridgePayload(mesaEmbedUrl = ICE_MESA_URL) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
      if (!canPlaceBet()) return null;
      const { active, dozenUnits, numberUnits, recovery, unitScale } = machine.cycle;
      const d1Label = iceDuziaLabel(active.dozen1);
      const d2Label = iceDuziaLabel(active.dozen2);
      const signalId = `ice:cov:${active.dozen1}-${active.dozen2}:${active.triggerNumbers.join("-")}:${recovery}:${unitScale}`;
      const stakeAmount = BASE_STAKE * dozenUnits;
      const betDelayUntilMs = lastLiveSpinAt != null ? lastLiveSpinAt + iceDuziaBetDelayMs(recovery) : null;
      const fibSuffix = recovery > 0 ? ` \xB7 fib \xD7${unitScale} (${dozenUnits} un./dz)` : ` \xB7 ${dozenUnits} un./dz`;
      const actions = [
        {
          kind: "click",
          target: "dozen-1",
          label: d1Label,
          reason: `ICE cobertura \xB7 ${d1Label}${fibSuffix}`,
          betKey: iceDuziaBetKey(active.dozen1),
          units: dozenUnits
        },
        {
          kind: "click",
          target: "dozen-2",
          label: d2Label,
          reason: `ICE cobertura \xB7 ${d2Label}${fibSuffix}`,
          betKey: iceDuziaBetKey(active.dozen2),
          units: dozenUnits
        }
      ];
      for (const n of active.coveredNumbers) {
        actions.push({
          kind: "click",
          target: `num-${n}`,
          label: String(n),
          reason: `ICE cobertura \xB7 n\xBA ${n}${fibSuffix}`,
          betKey: iceNumberBetKey(n),
          units: numberUnits
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
          currentTableId: ICE_TABLE_ID,
          mesaEmbedUrl: mesaEmbedUrl ?? ICE_MESA_URL,
          mesaProvider: "outro",
          factor1Label: `${d1Label} \xB7 ${d2Label}`,
          factor2Label: `+${active.coveredNumbers.length} n\xFAms`,
          factor1BetKey: iceDuziaBetKey(active.dozen1),
          factor2BetKey: iceDuziaBetKey(active.dozen2),
          singleFactorMode: false,
          signalId,
          stakeAmount,
          units: dozenUnits,
          unitScale,
          numberUnits,
          coveredNumbers: [...active.coveredNumbers],
          excludedNumbers: [...active.excludedNumbers],
          currentRecovery: recovery,
          baseStake: BASE_STAKE,
          maxRecovery: ICE_DUZIA_MAX_RECOVERY,
          executionMode: null,
          strategy: "iceDuzia",
          rotativaTrigger: "crossing",
          fastMultiTarget: true,
          betDelayUntilMs,
          mesaCatalog: []
        }
      };
    }
    return {
      tableId: ICE_TABLE_ID,
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
        maxRecovery: ICE_DUZIA_MAX_RECOVERY
      }),
      resetStats() {
        stats = emptyIceDuziaStats();
      },
      reset() {
        machine = defaultIceDuziaMachineState();
        stats = emptyIceDuziaStats();
        history = [];
        lastGameId = null;
        spinBaselined = false;
        liveSpinSeen = false;
        lastLiveSpinAt = null;
      }
    };
  }
  var api = {
    ICE_TABLE_ID,
    ICE_MESA_URL,
    ICE_MAX_GALES,
    ICE_DUZIA_FIBONACCI_UNITS,
    iceDuziaUnitsForRecovery,
    createIceCruzamentoEngine
  };
  if (typeof globalThis !== "undefined") {
    globalThis.SinglestakeIceCruzamento = api;
  }
  var ice_strategy_entry_default = api;
  return __toCommonJS(ice_strategy_entry_exports);
})();
