/**
 * Harness de simulação — estratégia Um Fator em rodízio de mesas.
 * Independente do provedor do casino (Playtech, Pragmatic, etc.).
 * A app usa isto para decidir mesa, recuperação e momento da entrada;
 * o URL do jogo vem de `casinoEmbedConfig` / variáveis de ambiente.
 */

import { stakeForRecovery } from "@/lib/back-office/rouletteAutomationSim";
import { emptyRotatingRoomSessionStats } from "@/lib/roulette/entryWinBreakdown";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { ROTATING_ROOM_FIXED_TABLE_IDS } from "@/lib/roulette/lobbyTables";
import {
  pragmaticExteriorBetKeyFromFactor,
  type PragmaticExteriorBetKey,
} from "@/lib/roulette/pragmaticExteriorBetMap";
import { umFatorMachinePlacarStepProgressed } from "@/lib/roulette/rotatingRoomUmFatorPlacarDrive";
import {
  buildUmFatorLiveView,
  defaultUmFatorMachineState,
  sanitizeUmFatorMachineForTableIds,
  seedUmFatorMachineAfterPlacarReset,
  tickUmFatorPlacar,
  UM_FATOR_MAX_RECOVERY,
  type UmFatorMachineState,
  type UmFatorPlacarFlash,
} from "@/lib/roulette/rotatingRoomUmFatorStrategy";
import type { RotatingRoomSessionStats } from "@/lib/roulette/rotatingRoomStrategy";
import { drainPlacarSteps } from "@/lib/roulette/strategySessionDrive";
import { umFatorAlertLabel } from "@/lib/roulette/umFatorStrategy";

export type RotatingUmFatorSpinEvent = {
  tableId: number;
  number: number;
  /** Ordenação opcional (ISO ou epoch ms). */
  at?: string | number;
};

export type RotatingUmFatorReplayInput = {
  /** Mesas do rodízio. Por defeito: lista fixa da sala rotativa. */
  tableIds?: readonly number[];
  events: readonly RotatingUmFatorSpinEvent[];
};

/** Indicação agnóstica de provedor — o que a automação / app consome. */
export type RotatingUmFatorIndication = {
  action: "wait" | "bet";
  tableId: number | null;
  tableLabel: string | null;
  alertLabel: string | null;
  recovery: number;
  stake: number;
  signalId: string | null;
  focusTableId: number | null;
  /** Chave odd/even/red/black/low/high — usada pela extensão Chrome no DOM da mesa. */
  exteriorBetKey: PragmaticExteriorBetKey | null;
};

export type RotatingUmFatorReplayLogEntry = {
  step: number;
  tableId: number;
  number: number;
  indication: RotatingUmFatorIndication;
  flash: UmFatorPlacarFlash;
  recovery: number;
  wins: number;
  losses: number;
  tableFocus: number | null;
};

export type RotatingUmFatorReplayResult = {
  tableIds: readonly number[];
  logs: RotatingUmFatorReplayLogEntry[];
  finalMachine: UmFatorMachineState;
  finalStats: RotatingRoomSessionStats;
  finalIndication: RotatingUmFatorIndication;
};

export function buildRotatingUmFatorIndication(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: UmFatorMachineState,
): RotatingUmFatorIndication {
  const view = buildUmFatorLiveView(tableIds, histories, machine);
  const tableId = view.globalTableId;
  const active = view.globalActive;
  const recovery = machine.recovery;
  const stake = stakeForRecovery(recovery);

  if (tableId != null && active) {
    const alertLabel = umFatorAlertLabel(active);
    const tableLabel = lobbyTableDisplayName(tableId);
    const exteriorBetKey = pragmaticExteriorBetKeyFromFactor(active.alertFactor);
    return {
      action: "bet",
      tableId,
      tableLabel,
      alertLabel,
      recovery,
      stake,
      signalId: `${tableId}:${active.resultNumber}:${alertLabel}:${recovery}`,
      focusTableId: machine.focusLockTableId ?? tableId,
      exteriorBetKey,
    };
  }

  const focusTableId = machine.focusLockTableId ?? machine.lastActiveTableId;
  return {
    action: "wait",
    tableId: focusTableId,
    tableLabel: focusTableId != null ? lobbyTableDisplayName(focusTableId) : null,
    alertLabel: null,
    recovery,
    stake,
    signalId: null,
    focusTableId,
    exteriorBetKey: null,
  };
}

function drainUmFatorTick(
  tableIds: readonly number[],
  histories: Record<number, readonly number[]>,
  machine: UmFatorMachineState,
  stats: RotatingRoomSessionStats,
): {
  nextMachine: UmFatorMachineState;
  stats: RotatingRoomSessionStats;
  statsChanged: boolean;
  flash: UmFatorPlacarFlash;
} {
  return drainPlacarSteps(
    machine,
    stats,
    (currentMachine, currentStats) => {
      const step = tickUmFatorPlacar(
        tableIds,
        histories,
        currentMachine,
        currentStats,
        UM_FATOR_MAX_RECOVERY,
      );
      return {
        ...step,
        nextMachine: sanitizeUmFatorMachineForTableIds(step.nextMachine, tableIds),
      };
    },
    umFatorMachinePlacarStepProgressed,
  );
}

function resolveTableIds(input: RotatingUmFatorReplayInput): number[] {
  if (input.tableIds && input.tableIds.length > 0) return [...input.tableIds];
  const fromEvents = [...new Set(input.events.map((e) => e.tableId))];
  if (fromEvents.length > 0) {
    const fixedSet = new Set(ROTATING_ROOM_FIXED_TABLE_IDS);
    const ordered = ROTATING_ROOM_FIXED_TABLE_IDS.filter((id) => fromEvents.includes(id));
    const extra = fromEvents.filter((id) => !fixedSet.has(id)).sort((a, b) => a - b);
    return [...ordered, ...extra];
  }
  return [...ROTATING_ROOM_FIXED_TABLE_IDS];
}

function sortEvents(events: readonly RotatingUmFatorSpinEvent[]): RotatingUmFatorSpinEvent[] {
  return [...events].sort((a, b) => {
    const ta = a.at != null ? Number(new Date(a.at)) || 0 : 0;
    const tb = b.at != null ? Number(new Date(b.at)) || 0 : 0;
    if (ta !== tb) return ta - tb;
    return 0;
  });
}

/** Reproduz giros cronológicos e devolve o log de indicações / resultados. */
export function replayRotatingUmFatorStrategy(
  input: RotatingUmFatorReplayInput,
): RotatingUmFatorReplayResult {
  const tableIds = resolveTableIds(input);
  const histories: Record<number, number[]> = {};
  for (const id of tableIds) histories[id] = [];

  let machine = seedUmFatorMachineAfterPlacarReset(defaultUmFatorMachineState(), tableIds, histories);
  let stats = emptyRotatingRoomSessionStats(UM_FATOR_MAX_RECOVERY);
  const logs: RotatingUmFatorReplayLogEntry[] = [];

  const events = sortEvents(input.events);
  let step = 0;

  for (const event of events) {
    if (!histories[event.tableId]) histories[event.tableId] = [];
    histories[event.tableId]!.unshift(event.number);

    const result = drainUmFatorTick(tableIds, histories, machine, stats);
    machine = result.nextMachine;
    stats = result.stats;

    step += 1;
    logs.push({
      step,
      tableId: event.tableId,
      number: event.number,
      indication: buildRotatingUmFatorIndication(tableIds, histories, machine),
      flash: result.flash,
      recovery: machine.recovery,
      wins: stats.wins,
      losses: stats.losses,
      tableFocus: machine.focusLockTableId ?? machine.lastActiveTableId,
    });
  }

  return {
    tableIds,
    logs,
    finalMachine: machine,
    finalStats: stats,
    finalIndication: buildRotatingUmFatorIndication(tableIds, histories, machine),
  };
}

export function formatRotatingUmFatorReplayLine(entry: RotatingUmFatorReplayLogEntry): string {
  const mesa = lobbyTableDisplayName(entry.tableId);
  const ind = entry.indication;
  const parts: string[] = [
    `#${entry.step}`,
    `${mesa}→${entry.number}`,
    `rec=${entry.recovery}`,
    `W/L=${entry.wins}/${entry.losses}`,
  ];

  if (entry.flash) {
    const f = entry.flash;
    parts.push(
      f.won ? `VITÓRIA@${f.resultNumber}` : f.kind === "recovery" ? `RECUP@${f.resultNumber}` : `DERROTA@${f.resultNumber}`,
    );
  }

  if (ind.action === "bet" && ind.tableId != null) {
    parts.push(`SINAL→${ind.tableLabel}·${ind.alertLabel}·R$${ind.stake}`);
  } else if (ind.tableLabel) {
    parts.push(`aguardar·${ind.tableLabel}`);
  }

  if (entry.tableFocus != null && entry.tableFocus !== entry.tableId) {
    parts.push(`foco=${lobbyTableDisplayName(entry.tableFocus)}`);
  }

  return parts.join(" | ");
}

export const ROTATING_UM_FATOR_SIM_FIXTURE_HELP = {
  tableIds: "opcional — ids do rodízio (default: sala rotativa)",
  events: [
    { tableId: 227, number: 19, at: "2026-06-24T10:00:00Z" },
    { tableId: 203, number: 14, at: "2026-06-24T10:00:30Z" },
  ],
  note: "Histórico por mesa é newest-first; cada evento acrescenta um giro no topo.",
};
