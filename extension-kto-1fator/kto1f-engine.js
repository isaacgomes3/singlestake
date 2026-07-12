"use strict";
var SinglestakeKto1f = (() => {
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

  // extension-kto-1fator/kto1f-strategy-entry.ts
  var kto1f_strategy_entry_exports = {};
  __export(kto1f_strategy_entry_exports, {
    KTO1F_MAX_GALES: () => KTO1F_MAX_GALES,
    KTO1F_MESA_URL: () => KTO1F_MESA_URL,
    KTO1F_TABLE_ID: () => KTO1F_TABLE_ID,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS: () => ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS: () => ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    createKto1fEngine: () => createKto1fEngine,
    default: () => kto1f_strategy_entry_default
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

  // src/lib/roulette/kto1fScoreStrategy.ts
  var KTO_1F_TABLE_ID = 230;
  var KTO_1F_MESA_URL = "https://www.kto.bet.br/app/cassino/game/roulette-3-ppl/";
  var KTO_1F_MIN_HISTORY = 13;
  var KTO_1F_MAX_RECOVERY = 5;
  var KTO_1F_RECOVERY_BET_DELAY_MS = 6e3;
  var KTO_1F_IMMEDIATE_REBET_DELAY_MS = 6e3;
  var KTO_1F_FIRST_BET_SETTLE_MS = KTO_1F_RECOVERY_BET_DELAY_MS;
  var KTO_1F_BET_DELAY_MS = KTO_1F_RECOVERY_BET_DELAY_MS;
  var KTO_1F_STAKE_UNITS = [1, 2, 4, 8, 16, 32];
  var KTO_1F_FACTOR_KINDS = ["paridade", "cor", "altura"];
  function emptyScore() {
    return { wins: 0, losses: 0, last: null };
  }
  function emptyKto1fScoreboard() {
    return {
      paridade: emptyScore(),
      cor: emptyScore(),
      altura: emptyScore()
    };
  }
  function defaultKto1fMachineState() {
    return {
      lastSpinHead: null,
      scoreboard: emptyKto1fScoreboard(),
      cycle: null,
      pendingRecovery: 0,
      betCommitInFlight: false,
      totalRounds: 0
    };
  }
  function emptyKto1fStats(maxRecovery = KTO_1F_MAX_RECOVERY) {
    return emptyRotatingRoomSessionStats(maxRecovery);
  }
  function parseKto1fStats(raw, maxRecovery = KTO_1F_MAX_RECOVERY) {
    return parseRotatingRoomSessionStats(raw, maxRecovery);
  }
  function spinHead(history) {
    if (history.length === 0) return "0";
    return `${history.length}:${history[0]}`;
  }
  function factorForKind(n, kind) {
    if (n === 0) return null;
    if (kind === "cor") {
      const v2 = colorOf(n);
      if (v2 === "Zero") return null;
      return { kind: "cor", value: v2 };
    }
    if (kind === "altura") {
      const v2 = heightOf(n);
      if (v2 === "Zero") return null;
      return { kind: "altura", value: v2 };
    }
    const v = parityOf(n);
    if (v === "Zero") return null;
    return { kind: "paridade", value: v };
  }
  function sharesKind(a, b, kind) {
    const fa = factorForKind(a, kind);
    const fb = factorForKind(b, kind);
    if (!fa || !fb) return false;
    return fa.value === fb.value;
  }
  function displayLast(f) {
    if (!f) return null;
    if (f.kind === "paridade") return f.value === "Par" ? "Par" : "\xCDmpar";
    if (f.kind === "altura") return f.value === "Baixo" ? "Baixo" : "Alto";
    return f.value === "Vermelho" ? "Vermelho" : "Preto";
  }
  var KIND_TIE_RANK = {
    altura: 0,
    cor: 1,
    paridade: 2
  };
  function kto1fBestKind(board) {
    let best = null;
    for (const kind of KTO_1F_FACTOR_KINDS) {
      const s = board[kind];
      if (s.wins <= 0) continue;
      if (!best) {
        best = kind;
        continue;
      }
      const b = board[best];
      if (s.wins > b.wins) best = kind;
      else if (s.wins === b.wins && s.losses < b.losses) best = kind;
      else if (s.wins === b.wins && s.losses === b.losses && KIND_TIE_RANK[kind] < KIND_TIE_RANK[best]) {
        best = kind;
      }
    }
    return best;
  }
  function kto1fUpdateScoreboard(board, historyNewestFirst) {
    if (historyNewestFirst.length < KTO_1F_MIN_HISTORY) return board;
    const n1 = historyNewestFirst[0];
    const n13 = historyNewestFirst[12];
    const n12 = historyNewestFirst[11];
    const next = emptyKto1fScoreboard();
    for (const kind of KTO_1F_FACTOR_KINDS) {
      const prev = board[kind];
      const lastFactor = factorForKind(n12, kind) ?? factorForKind(n1, kind);
      const last = displayLast(lastFactor) ?? prev.last;
      if (n1 === 0 || n13 === 0) {
        next[kind] = { wins: 0, losses: prev.losses + 1, last };
        continue;
      }
      if (sharesKind(n1, n13, kind)) {
        next[kind] = { wins: prev.wins + 1, losses: 0, last };
      } else {
        next[kind] = { wins: 0, losses: prev.losses + 1, last };
      }
    }
    return next;
  }
  function kto1fPrimeScoreboardFromHistory(historyNewestFirst) {
    let board = emptyKto1fScoreboard();
    if (historyNewestFirst.length < KTO_1F_MIN_HISTORY) return board;
    for (let end = KTO_1F_MIN_HISTORY; end <= historyNewestFirst.length; end++) {
      const slice = historyNewestFirst.slice(0, end);
      void slice;
    }
    const chrono = [...historyNewestFirst].reverse();
    for (let i = KTO_1F_MIN_HISTORY - 1; i < chrono.length; i++) {
      const newestFirst = chrono.slice(0, i + 1).reverse();
      board = kto1fUpdateScoreboard(board, newestFirst);
    }
    return board;
  }
  function kto1fBuildActiveFromBoard(historyNewestFirst, board) {
    if (historyNewestFirst.length < KTO_1F_MIN_HISTORY) return null;
    const kind = kto1fBestKind(board);
    if (!kind) return null;
    const n12 = historyNewestFirst[11];
    const n1 = historyNewestFirst[0];
    const n13 = historyNewestFirst[12];
    const alertFactor = factorForKind(n12, kind);
    if (!alertFactor) return null;
    const scoreWins = board[kind].wins;
    return {
      alertKind: kind,
      alertFactor,
      scoreWins,
      baseNumber: n12,
      compareA: n1,
      compareB: n13,
      armingDescription: `1F score ${kind}\xD7${scoreWins}: pos1\xB7${n1}\xD7pos13\xB7${n13} \u2192 pos12\xB7${n12} ${doisFatoresFactorLabel(alertFactor)}`
    };
  }
  function kto1fClassifyBetRound(result, active) {
    if (result === 0) return "L";
    const f = active.alertFactor;
    if (f.kind === "cor") return colorOf(result) === f.value ? "W" : "L";
    if (f.kind === "altura") return heightOf(result) === f.value ? "W" : "L";
    return parityOf(result) === f.value ? "W" : "L";
  }
  function kto1fStakeUnits(recovery) {
    const idx = Math.min(
      Math.max(0, Math.floor(recovery)),
      KTO_1F_STAKE_UNITS.length - 1
    );
    return KTO_1F_STAKE_UNITS[idx];
  }
  function kto1fDoubleClicks(recovery) {
    return Math.max(0, Math.floor(recovery));
  }
  function kto1fPadFactorPlacementMs(_units) {
    return 0;
  }
  function kto1fBetDelayMs(_recovery, immediateBet) {
    return immediateBet === true ? KTO_1F_IMMEDIATE_REBET_DELAY_MS : KTO_1F_RECOVERY_BET_DELAY_MS;
  }
  function kto1fBetDelayUntilMs(recovery, lastSpinAtMs, immediateBet) {
    const delayMs = kto1fBetDelayMs(recovery, immediateBet);
    return lastSpinAtMs != null && Number.isFinite(lastSpinAtMs) ? lastSpinAtMs + delayMs : null;
  }
  function canPlaceKto1fBet(recovery, lastSpinAtMs, nowMs = Date.now(), immediateBet) {
    if (lastSpinAtMs == null || !Number.isFinite(lastSpinAtMs)) return false;
    return nowMs - lastSpinAtMs >= kto1fBetDelayMs(recovery, immediateBet);
  }
  function clearCycleKeepGale(machine, recoveryToKeep) {
    return {
      ...machine,
      cycle: null,
      betCommitInFlight: false,
      pendingRecovery: Math.max(0, Math.floor(recoveryToKeep))
    };
  }
  function armFromBoard(machine, history, head, recovery) {
    const active = kto1fBuildActiveFromBoard(history, machine.scoreboard);
    if (!active) return machine;
    return {
      ...machine,
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
  function tryArmKto1fCycle(machine, history, head) {
    if (machine.cycle) return machine;
    if (history.length < KTO_1F_MIN_HISTORY) return machine;
    const pending = Math.max(0, Math.floor(machine.pendingRecovery ?? 0));
    return armFromBoard(machine, history, head, pending);
  }
  function tickKto1fPlacar(historyNewestFirst, machine, stats, maxRecovery = KTO_1F_MAX_RECOVERY) {
    const head = spinHead(historyNewestFirst);
    const headChanged = machine.lastSpinHead != null && machine.lastSpinHead !== head;
    let nextMachine = {
      ...machine,
      lastSpinHead: head,
      scoreboard: { ...machine.scoreboard },
      pendingRecovery: machine.pendingRecovery ?? 0
    };
    let nextStats = stats;
    let statsChanged = false;
    let flash = null;
    let missedBetWindow = false;
    if (nextMachine.cycle?.phase === "awaiting_bet" && headChanged && nextMachine.cycle.armedHead !== head) {
      missedBetWindow = true;
      nextMachine = clearCycleKeepGale(nextMachine, nextMachine.cycle.recovery);
    }
    if (nextMachine.cycle && headChanged && nextMachine.cycle.phase === "awaiting_result") {
      const cycle = nextMachine.cycle;
      const resultNumber = historyNewestFirst[0];
      const outcome = kto1fClassifyBetRound(resultNumber, cycle.active);
      const { active, recovery } = cycle;
      if (outcome === "W") {
        nextStats = recordRotatingRoomSessionWin(nextStats, recovery, maxRecovery);
        statsChanged = true;
        nextMachine = clearCycleKeepGale(nextMachine, 0);
        flash = {
          resultNumber,
          won: true,
          kind: "win",
          alertKind: active.alertKind,
          alertFactor: active.alertFactor,
          recovery
        };
      } else {
        const nextRecovery = recovery + 1;
        if (nextRecovery > maxRecovery) {
          nextStats = recordRotatingRoomSessionFinalLoss(nextStats, recovery, maxRecovery);
          statsChanged = true;
          nextMachine = clearCycleKeepGale(nextMachine, 0);
          flash = {
            resultNumber,
            won: false,
            kind: "loss",
            alertKind: active.alertKind,
            alertFactor: active.alertFactor,
            recovery
          };
        } else {
          nextStats = recordRotatingRoomSessionPartialLoss(nextStats, recovery, maxRecovery);
          statsChanged = true;
          flash = {
            resultNumber,
            won: false,
            kind: "loss",
            alertKind: active.alertKind,
            alertFactor: active.alertFactor,
            recovery
          };
          nextMachine = clearCycleKeepGale(nextMachine, nextRecovery);
        }
      }
    }
    if (headChanged && historyNewestFirst.length >= KTO_1F_MIN_HISTORY) {
      nextMachine = {
        ...nextMachine,
        scoreboard: kto1fUpdateScoreboard(nextMachine.scoreboard, historyNewestFirst),
        totalRounds: (nextMachine.totalRounds ?? 0) + 1
      };
    }
    if (!nextMachine.cycle && headChanged && historyNewestFirst.length >= KTO_1F_MIN_HISTORY) {
      nextMachine = tryArmKto1fCycle(nextMachine, historyNewestFirst, head);
    }
    if (!nextMachine.cycle && machine.lastSpinHead == null && historyNewestFirst.length >= KTO_1F_MIN_HISTORY) {
      nextMachine = tryArmKto1fCycle(nextMachine, historyNewestFirst, head);
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
  function kto1fKindLabel(kind) {
    if (kind === "paridade") return "Paridade";
    if (kind === "cor") return "Cor";
    return "Altura";
  }
  function kto1fWatchLabelForMachine(machine) {
    const best = kto1fBestKind(machine.scoreboard);
    if (!best) return "aguarda coincid\xEAncia 1\xD713";
    const s = machine.scoreboard[best];
    const gale = machine.cycle?.recovery ?? machine.pendingRecovery ?? 0;
    return `${kto1fKindLabel(best)} ${s.wins}v \xB7 gale ${gale}`;
  }
  function formatKto1fWatchLabel(_board) {
    return "pos 1\xD713 \xB7 score \u2192 alerta pos 12";
  }

  // extension-kto-1fator/kto1f-strategy-entry.ts
  var KTO1F_TABLE_ID = KTO_1F_TABLE_ID;
  var KTO1F_MESA_URL = KTO_1F_MESA_URL;
  var KTO1F_MAX_GALES = KTO_1F_MAX_RECOVERY;
  var ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS = KTO_1F_FIRST_BET_SETTLE_MS;
  var ROTATING_ROOM_CROSSING_BET_DELAY_MS = KTO_1F_RECOVERY_BET_DELAY_MS;
  var BASE_STAKE = 0.5;
  function clampMaxRecovery(value, fallback = KTO_1F_MAX_RECOVERY) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback));
    return Math.min(KTO_1F_MAX_RECOVERY, Math.max(0, Math.floor(n)));
  }
  function pendingRecoveryFromSaved(saved) {
    const stored = typeof saved.pendingRecovery === "number" && Number.isFinite(saved.pendingRecovery) ? Math.max(0, Math.floor(saved.pendingRecovery)) : 0;
    if (stored > 0) return stored;
    const recovery = typeof saved.recovery === "number" && Number.isFinite(saved.recovery) ? Math.max(0, Math.floor(saved.recovery)) : 0;
    if (saved.phase === "awaiting_bet" || saved.phase === "awaiting_result") {
      return recovery;
    }
    return 0;
  }
  function createKto1fEngine(options = {}) {
    const maxRecovery = clampMaxRecovery(options.maxRecovery);
    let machine = defaultKto1fMachineState();
    if (options.initialMachine) {
      const saved = options.initialMachine;
      machine = {
        ...machine,
        lastSpinHead: saved.lastSpinHead ?? null,
        pendingRecovery: pendingRecoveryFromSaved(saved),
        totalRounds: typeof saved.totalRounds === "number" && Number.isFinite(saved.totalRounds) ? Math.max(0, Math.floor(saved.totalRounds)) : 0
      };
    }
    let pendingRestore = options.initialMachine ?? null;
    let stats = options.initialStats != null ? parseKto1fStats(options.initialStats, maxRecovery) : emptyKto1fStats(maxRecovery);
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
      const tick = tickKto1fPlacar(history, machine, stats, maxRecovery);
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
      const scoreboard = kto1fPrimeScoreboardFromHistory(history);
      const preservedCycle = machine.cycle;
      machine = {
        ...defaultKto1fMachineState(),
        scoreboard,
        lastSpinHead: head,
        totalRounds: machine.totalRounds
      };
      if (preservedCycle?.phase === "awaiting_result") {
        machine = {
          ...machine,
          pendingRecovery: 0,
          cycle: {
            ...preservedCycle,
            phase: "awaiting_result",
            armedHead: head
          }
        };
      } else if (pendingRestore) {
        const pendingRecovery = pendingRecoveryFromSaved(pendingRestore);
        const totalRounds = typeof pendingRestore.totalRounds === "number" && Number.isFinite(pendingRestore.totalRounds) ? Math.max(0, Math.floor(pendingRestore.totalRounds)) : 0;
        pendingRestore = null;
        machine = {
          ...machine,
          pendingRecovery,
          totalRounds
        };
        if (history.length >= KTO_1F_MIN_HISTORY) {
          machine = tryArmKto1fCycle(machine, history, head);
        }
      } else if (history.length >= KTO_1F_MIN_HISTORY) {
        machine = tryArmKto1fCycle(machine, history, head);
      }
      lastLiveSpinAt = Date.now();
      const tick = tickKto1fPlacar(history, machine, stats, maxRecovery);
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
      if (history.length > 80) history.length = 80;
      return runTick();
    }
    function canPlaceBet(nowMs = Date.now()) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return false;
      return canPlaceKto1fBet(
        machine.cycle.recovery,
        lastLiveSpinAt,
        nowMs,
        machine.cycle.immediateBet === true
      );
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
    function buildBridgePayload(mesaEmbedUrl = KTO1F_MESA_URL) {
      if (!machine.cycle || machine.cycle.phase !== "awaiting_bet") return null;
      if (!canPlaceBet()) return null;
      const { active, recovery } = machine.cycle;
      const units = kto1fStakeUnits(recovery);
      const doubles = kto1fDoubleClicks(recovery);
      const signalId = `kto1f:${active.alertKind}:base${active.baseNumber}:r${recovery}`;
      const f1Key = pragmaticExteriorBetKeyFromFactor(active.alertFactor);
      const f1Label = doisFatoresFactorLabel(active.alertFactor);
      const stakeAmount = BASE_STAKE * units;
      const betDelayUntilMs = kto1fBetDelayUntilMs(
        recovery,
        lastLiveSpinAt,
        machine.cycle.immediateBet === true
      );
      const galeSuffix = recovery > 0 ? ` \xB7 gale ${recovery}` : " \xB7 entrada";
      const actions = [
        {
          kind: "click",
          target: "factor-1",
          label: f1Label,
          reason: `KTO 1F \xB7 ${f1Label}${galeSuffix}`
        }
      ];
      for (let i = 0; i < doubles; i++) {
        actions.push({
          kind: "click",
          target: "repeat-bet",
          label: "Dobrar",
          reason: `KTO 1F \xB7 Dobrar ${i + 1}/${doubles}${galeSuffix}`
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
          currentTableId: KTO1F_TABLE_ID,
          mesaEmbedUrl: mesaEmbedUrl ?? KTO1F_MESA_URL,
          mesaProvider: "outro",
          factor1Label: f1Label,
          factor2Label: null,
          factor1BetKey: f1Key,
          factor2BetKey: null,
          singleFactorMode: true,
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
          strategy: "kto1fator",
          rotativaTrigger: "umFator",
          betDelayUntilMs,
          mesaCatalog: []
        }
      };
    }
    return {
      tableId: KTO1F_TABLE_ID,
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
        stats = emptyKto1fStats(maxRecovery);
      },
      reset() {
        machine = defaultKto1fMachineState();
        stats = emptyKto1fStats(maxRecovery);
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
    KTO1F_TABLE_ID,
    KTO1F_MESA_URL,
    KTO1F_MAX_GALES,
    KTO_1F_BET_DELAY_MS,
    KTO_1F_FIRST_BET_SETTLE_MS,
    KTO_1F_IMMEDIATE_REBET_DELAY_MS,
    KTO_1F_MAX_RECOVERY,
    KTO_1F_RECOVERY_BET_DELAY_MS,
    ROTATING_ROOM_MESA_FIRST_CLICK_SETTLE_MS,
    ROTATING_ROOM_CROSSING_BET_DELAY_MS,
    formatKto1fWatchLabel,
    kto1fWatchLabelForMachine,
    kto1fBetDelayMs,
    kto1fBetDelayUntilMs,
    kto1fPadFactorPlacementMs,
    kto1fDoubleClicks,
    kto1fStakeUnits,
    createKto1fEngine,
    kto1fBestKind,
    kto1fKindLabel
  };
  if (typeof globalThis !== "undefined") {
    globalThis.SinglestakeKto1f = api;
  }
  var kto1f_strategy_entry_default = api;
  return __toCommonJS(kto1f_strategy_entry_exports);
})();
