import { MapPin, ChevronDown, ChevronUp, ChevronsUp, Repeat2, RotateCcw, Trash2, Bot } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";

import { RouletteSimulatorCountdownStrip } from "@/components/roulette-simulator-countdown-strip";
import { RouletteSimulatorTapeteOverlay } from "@/components/roulette-simulator-tapete-overlay";
import { RouletteSpinWheel } from "@/components/roulette-spin-wheel";
import { SimulatorBoardViewportControls } from "@/components/simulator-board-viewport-controls";
import { useRotatingRoomSimulatorIndication } from "@/hooks/useRotatingRoomSimulatorIndication";
import { useSimulatorBoardViewport } from "@/hooks/useSimulatorBoardViewport";
import { useSimulatorChipDrag } from "@/hooks/useSimulatorChipDrag";
import { useRouletteSimulatorLiveSpin } from "@/hooks/useRouletteSimulatorLiveSpin";
import { useRouletteSimulatorSpinClock } from "@/hooks/useRouletteSimulatorSpinClock";
import { lobbyTableDisplayName } from "@/lib/roulette/lobbyTables";
import { exteriorBetKeyToRouletteBetKind } from "@/lib/roulette/rotatingRoomSimulatorIndication";
import {
  betAreaKey,
  betAreaLabel,
  betPayoutMultiplier,
  mergePlacedBets,
  parseBetAreaKey,
  ROULETTE_SIMULATOR_CHIP_VALUES,
  ROULETTE_SIMULATOR_STARTING_BALANCE,
  settleRouletteBets,
  type PlacedRouletteBet,
  type RouletteBetKind,
  type RouletteRoundSettlement,
  type RouletteSimulatorChipValue,
} from "@/lib/roulette/rouletteBetSettlement";
import { colorOf } from "@/lib/roulette/streetPairTrigger";
import { cn } from "@/lib/utils";

type Props = {
  tableIds: readonly number[];
  histories: Record<number, number[]>;
  defaultTableId: number;
};

type SessionStats = {
  roundsPlayed: number;
  totalWins: number;
  totalLosses: number;
  netProfit: number;
  totalWagered: number;
};

const SIM_SPIN_HISTORY_LEN = 12;

function historyChipClass(n: number, isLatest: boolean): string {
  return cn(
    "inline-flex h-6 min-w-[1.35rem] shrink-0 items-center justify-center rounded border px-0.5 text-[10px] font-bold tabular-nums leading-none shadow-inner sm:h-7 sm:min-w-[1.5rem] sm:text-[11px]",
    numberCellClass(n),
    isLatest && "ring-2 ring-white/90",
  );
}

function numberCellClass(n: number) {
  const c = colorOf(n);
  if (c === "Zero") return "border-emerald-500/50 bg-emerald-600/85 text-white";
  if (c === "Vermelho") return "border-red-400/35 bg-red-600/80 text-white";
  return "border-slate-600 bg-slate-900 text-slate-100";
}

function ChipMarker({ amount }: { amount: number }) {
  const label = amount >= 100 ? "100" : amount >= 10 ? String(amount) : String(amount);
  const size = amount >= 25 ? "h-9 w-9 text-xs" : "h-8 w-8 text-[11px]";
  return (
    <span
      className={cn(
        "pointer-events-none absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 translate-y-[48%] items-center justify-center rounded-full border-2 border-amber-100/95 bg-amber-200 font-black leading-none text-amber-950 shadow-lg ring-2 ring-black/30",
        size,
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

function ChipOutsideMarker({ amount }: { amount: number }) {
  const label = amount >= 100 ? "100" : String(amount);
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-100/95 bg-amber-200 text-sm font-black text-amber-950 shadow-lg ring-2 ring-black/30"
      aria-hidden
    >
      {label}
    </span>
  );
}

type SimulatorBetCellProps = {
  area: RouletteBetKind;
  className?: string;
  style?: React.CSSProperties;
  chipAmount: number;
  label: string;
  resultPin?: boolean;
  betsLocked: boolean;
  chipStyle?: "bottom" | "center";
  onPlace: (remove: boolean) => void;
  chipDrag: ReturnType<typeof useSimulatorChipDrag>;
  children: React.ReactNode;
};

function SimulatorBetCell({
  area,
  className,
  style,
  chipAmount,
  label,
  resultPin,
  betsLocked,
  chipStyle = "center",
  onPlace,
  chipDrag,
  children,
}: SimulatorBetCellProps) {
  const betKey = betAreaKey(area);
  const drop = chipDrag.isDropTarget(area);
  const dragging = chipDrag.isDraggingFrom(area);

  return (
    <button
      type="button"
      data-bet-key={betKey}
      disabled={betsLocked}
      className={cn(
        "relative transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400 disabled:cursor-not-allowed disabled:opacity-60",
        chipAmount > 0 && !betsLocked && "cursor-grab active:cursor-grabbing",
        drop && "ring-2 ring-cyan-400/70 brightness-125",
        dragging && "opacity-70",
        className,
      )}
      style={style}
      aria-label={label}
      title={`${label} — clique para apostar · Shift+clique remove · arraste a ficha para mover`}
      onPointerDown={(e) => chipDrag.onBetPointerDown(e, area, chipAmount)}
      onPointerMove={chipDrag.onBetPointerMove}
      onPointerUp={chipDrag.onBetPointerUp}
      onPointerCancel={chipDrag.onBetPointerUp}
      onClick={(e) => chipDrag.onBetClick(e, onPlace)}
    >
      {chipAmount > 0 ? (
        chipStyle === "bottom" ? (
          <ChipMarker amount={chipAmount} />
        ) : (
          <ChipOutsideMarker amount={chipAmount} />
        )
      ) : null}
      {resultPin ? (
        <span className="pointer-events-none absolute left-1/2 top-0 z-[25] -translate-x-1/2 -translate-y-[28%]">
          <MapPin
            className="h-5 w-5 fill-amber-400 text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] sm:h-6 sm:w-6"
            aria-hidden
          />
        </span>
      ) : null}
      {children}
    </button>
  );
}

type RoundResult = {
  spin: number;
  netProfit: number;
};

export function RouletteSimulatorPanel({ tableIds, histories, defaultTableId }: Props) {
  const [tableId, setTableId] = useState(defaultTableId);
  const [followRotatingRoom, setFollowRotatingRoom] = useState(true);
  const { indication, connected: rotatingRoomConnected } = useRotatingRoomSimulatorIndication();
  const lastAutoSignalRef = useRef<string | null>(null);
  const [historySectionOpen, setHistorySectionOpen] = useState(true);
  const [chipValue, setChipValue] = useState<RouletteSimulatorChipValue>(5);
  const [balance, setBalance] = useState(ROULETTE_SIMULATOR_STARTING_BALANCE);
  const [betsByKey, setBetsByKey] = useState<Record<string, number>>({});
  const [lastRoundBetsByKey, setLastRoundBetsByKey] = useState<Record<string, number>>({});
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);
  const [resultPin, setResultPin] = useState<number | null>(null);
  const [lastSettlement, setLastSettlement] = useState<RouletteRoundSettlement | null>(null);
  const [flash, setFlash] = useState<"win" | "loss" | "neutral" | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    roundsPlayed: 0,
    totalWins: 0,
    totalLosses: 0,
    netProfit: 0,
    totalWagered: 0,
  });

  useEffect(() => {
    if (!tableIds.includes(tableId)) {
      setTableId(tableIds[0] ?? defaultTableId);
    }
  }, [tableIds, tableId, defaultTableId]);

  const history = histories[tableId] ?? [];
  const spinEvent = useRouletteSimulatorLiveSpin(tableId, history);

  const placedBets = useMemo((): PlacedRouletteBet[] => {
    const out: PlacedRouletteBet[] = [];
    for (const [key, chips] of Object.entries(betsByKey)) {
      if (chips <= 0) continue;
      const area = parseBetAreaKey(key);
      if (area) out.push({ area, chips });
    }
    return mergePlacedBets(out);
  }, [betsByKey]);

  const totalStaked = useMemo(
    () => placedBets.reduce((s, b) => s + b.chips, 0),
    [placedBets],
  );

  const lastRoundTotal = useMemo(
    () => Object.values(lastRoundBetsByKey).reduce((s, v) => s + v, 0),
    [lastRoundBetsByKey],
  );

  const canRepeat = lastRoundTotal > 0 && balance + totalStaked >= lastRoundTotal;
  const canDouble = totalStaked > 0 && balance >= totalStaked;

  const tableName = lobbyTableDisplayName(tableId);
  const recentSpins = useMemo(() => history.slice(0, SIM_SPIN_HISTORY_LEN), [history]);
  const spinClock = useRouletteSimulatorSpinClock(tableId, history);
  const betsLocked = spinClock.tapetePhase === "spinning";
  const countdownStripPhase =
    spinClock.tapetePhase === "hidden"
      ? "idle"
      : spinClock.tapetePhase === "reveal"
        ? "reveal"
        : spinClock.tapetePhase === "countdown"
          ? "countdown"
          : "spinning";

  const clearRoundResult = useCallback(() => setLastRoundResult(null), []);

  useEffect(() => {
    if (!followRotatingRoom || indication?.tableId == null) return;
    if (indication.action !== "bet") return;
    if (!tableIds.includes(indication.tableId)) return;
    setTableId(indication.tableId);
  }, [followRotatingRoom, indication?.tableId, indication?.action, tableIds]);

  useEffect(() => {
    if (indication?.action === "wait") {
      lastAutoSignalRef.current = null;
    }
  }, [indication?.action, indication?.signalId]);

  useEffect(() => {
    if (!followRotatingRoom || !indication) return;
    if (indication.action !== "bet" || !indication.betExteriorKey || !indication.signalId) return;
    if (indication.tableId !== tableId) return;
    if (betsLocked || spinClock.tapetePhase !== "countdown") return;
    if (lastAutoSignalRef.current === indication.signalId) return;
    if (totalStaked > 0) return;

    const stake = indication.suggestedStake;
    if (balance < stake) return;

    const area = exteriorBetKeyToRouletteBetKind(indication.betExteriorKey);
    const key = betAreaKey(area);
    lastAutoSignalRef.current = indication.signalId;
    clearRoundResult();
    setBalance((b) => b - stake);
    setBetsByKey({ [key]: stake });
  }, [
    followRotatingRoom,
    indication,
    tableId,
    betsLocked,
    spinClock.tapetePhase,
    totalStaked,
    balance,
    clearRoundResult,
  ]);

  const getChipOn = useCallback((area: RouletteBetKind) => betsByKey[betAreaKey(area)] ?? 0, [betsByKey]);

  const chipDrag = useSimulatorChipDrag(setBetsByKey, betsLocked, clearRoundResult);

  const placeOnArea = useCallback(
    (area: RouletteBetKind, remove: boolean) => {
      if (betsLocked) return;
      const key = betAreaKey(area);
      if (remove) {
        setBetsByKey((prev) => {
          const cur = prev[key] ?? 0;
          if (cur <= 0) return prev;
          const removed = Math.min(chipValue, cur);
          setBalance((b) => b + removed);
          const nextVal = cur - removed;
          if (nextVal === 0) {
            const { [key]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [key]: nextVal };
        });
        return;
      }
      if (balance < chipValue) return;
      clearRoundResult();
      setBalance((b) => b - chipValue);
      setBetsByKey((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + chipValue }));
    },
    [chipValue, balance, clearRoundResult, betsLocked],
  );

  const repeatBets = useCallback(() => {
    if (!canRepeat) return;
    clearRoundResult();
    setBalance((b) => b + totalStaked - lastRoundTotal);
    setBetsByKey({ ...lastRoundBetsByKey });
  }, [canRepeat, clearRoundResult, totalStaked, lastRoundTotal, lastRoundBetsByKey]);

  const doubleBets = useCallback(() => {
    if (!canDouble) return;
    clearRoundResult();
    setBalance((b) => b - totalStaked);
    setBetsByKey((prev) => {
      const next: Record<string, number> = {};
      for (const [key, chips] of Object.entries(prev)) {
        next[key] = chips * 2;
      }
      return next;
    });
  }, [canDouble, clearRoundResult, totalStaked]);

  const clearBets = useCallback(() => {
    setBetsByKey((prev) => {
      const refund = Object.values(prev).reduce((s, v) => s + v, 0);
      if (refund > 0) setBalance((b) => b + refund);
      return {};
    });
  }, []);

  const resetSession = useCallback(() => {
    clearBets();
    setBalance(ROULETTE_SIMULATOR_STARTING_BALANCE);
    setLastSettlement(null);
    setLastRoundBetsByKey({});
    setLastRoundResult(null);
    setFlash(null);
    setStats({
      roundsPlayed: 0,
      totalWins: 0,
      totalLosses: 0,
      netProfit: 0,
      totalWagered: 0,
    });
  }, [clearBets]);

  const placedBetsRef = useRef(placedBets);
  placedBetsRef.current = placedBets;
  const betsByKeyRef = useRef(betsByKey);
  betsByKeyRef.current = betsByKey;

  useEffect(() => {
    if (!spinEvent) return;
    setResultPin(spinEvent.number);
    if (spinEvent.isInitial) return;

    const bets = placedBetsRef.current;
    if (bets.length === 0) return;

    setLastRoundBetsByKey({ ...betsByKeyRef.current });

    const settlement = settleRouletteBets(spinEvent.number, bets);
    setLastSettlement(settlement);
    setLastRoundResult({ spin: spinEvent.number, netProfit: settlement.netProfit });
    setBalance((b) => b + settlement.totalReturned);
    setStats((s) => ({
      roundsPlayed: s.roundsPlayed + 1,
      totalWins: s.totalWins + settlement.winCount,
      totalLosses: s.totalLosses + settlement.lossCount,
      netProfit: s.netProfit + settlement.netProfit,
      totalWagered: s.totalWagered + settlement.totalStaked,
    }));
    if (settlement.netProfit > 0) setFlash("win");
    else if (settlement.netProfit < 0) setFlash("loss");
    else setFlash("neutral");
    setBetsByKey({});

    const t = window.setTimeout(() => setFlash(null), 2800);
    return () => window.clearTimeout(t);
  }, [spinEvent]);

  const viewport = useSimulatorBoardViewport();
  const {
    workspaceRef,
    stageRef,
    boardMeasureRef,
    boardZoom,
    isFullscreen,
    fit,
    fitReady,
    inlineScale,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleFullscreen,
    canZoomIn,
    canZoomOut,
  } = viewport;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-500/25 bg-[#0d1524]/90 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFollowRotatingRoom((v) => !v)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition",
              followRotatingRoom
                ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40"
                : "bg-slate-800/80 text-slate-400",
            )}
          >
            <Bot className="h-3.5 w-3.5" aria-hidden />
            Sala rotativa {followRotatingRoom ? "ON" : "OFF"}
          </button>
          {followRotatingRoom ? (
            <>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs",
                  rotatingRoomConnected ? "text-emerald-400" : "text-amber-400",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    rotatingRoomConnected ? "animate-pulse bg-emerald-400" : "bg-amber-400",
                  )}
                />
                {rotatingRoomConnected ? "Sinais em tempo real" : "A ligar sinais…"}
              </span>
              {indication ? (
                <span className="text-xs text-slate-400">
                  {indication.lobbyMessage}
                  {indication.action === "bet" && indication.alertLabel ? (
                    <span className="ml-2 font-semibold text-cyan-200">
                      → {indication.alertLabel} · {indication.suggestedStake} fichas
                      {indication.recovery > 0 ? ` (rec. ${indication.recovery})` : ""}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {indication ? (
                <span className="ml-auto text-[10px] font-semibold tabular-nums text-slate-500">
                  {indication.aproveitamentoPct.toFixed(0)}% · {indication.wins} · {indication.losses}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-slate-500">Apostas manuais no tapete</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/90 bg-[#0d1524]/90 p-4 sm:flex-row sm:items-center sm:gap-4">
        <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:min-w-[7.5rem]">
          Simulador de roleta
        </p>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setHistorySectionOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-300"
            aria-expanded={historySectionOpen}
          >
            Últimos giros · {tableName}
            {historySectionOpen ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
          </button>

          {historySectionOpen ? (
            <div
              className="flex max-w-full flex-nowrap items-center justify-center gap-1 overflow-x-auto pb-0.5"
              aria-label={`Últimos ${SIM_SPIN_HISTORY_LEN} giros de ${tableName}`}
            >
              {recentSpins.length === 0 ? (
                <span className="text-[10px] font-medium text-slate-500">Aguardando giros…</span>
              ) : (
                recentSpins.map((n, i) => (
                  <span key={`${tableId}-hist-${i}-${n}`} className={historyChipClass(n, i === 0)}>
                    {n}
                  </span>
                ))
              )}
            </div>
          ) : (
            <div
              className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 py-1"
              role="status"
              aria-label="A aguardar próximo giro"
            >
              <RouletteSpinWheel size="mini" />
              <span className="text-[10px] font-semibold text-amber-200/85">A aguardar giro…</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-center sm:justify-end">
          <label className="sr-only" htmlFor="sim-mesa">
            Mesa ao vivo
          </label>
          <select
            id="sim-mesa"
            value={tableId}
            onChange={(e) => setTableId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-semibold text-slate-100 sm:w-auto"
          >
            {tableIds.map((tid) => (
              <option key={tid} value={tid}>
                {lobbyTableDisplayName(tid)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={workspaceRef}
        className={cn(
          "grid gap-4 lg:grid-cols-[1fr_280px]",
          isFullscreen &&
            "fixed inset-0 z-[120] max-h-dvh overflow-y-auto bg-[#060a14] p-3 sm:p-4 lg:overflow-hidden lg:grid-rows-[minmax(0,1fr)]",
        )}
      >
        <div className={cn("space-y-3", isFullscreen && "flex min-h-0 min-w-0 flex-col")}>
          <div
            className={cn(
              "relative overflow-x-auto rounded-2xl border bg-slate-950/90 p-3 shadow-inner transition",
              isFullscreen && "flex min-h-0 flex-1 flex-col overflow-hidden",
              flash === "win" && "border-emerald-400/60 ring-2 ring-emerald-400/25",
              flash === "loss" && "border-rose-400/50 ring-2 ring-rose-400/20",
              flash === "neutral" && "border-amber-400/40",
              !flash && "border-emerald-500/25 ring-1 ring-white/5",
            )}
          >
            <SimulatorBoardViewportControls
              boardZoom={boardZoom}
              isFullscreen={isFullscreen}
              canZoomIn={canZoomIn}
              canZoomOut={canZoomOut}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onZoomReset={zoomReset}
              onToggleFullscreen={toggleFullscreen}
              className={cn("absolute right-2 top-2 z-[35]", isFullscreen && "right-3 top-3 sm:right-4 sm:top-4")}
            />
            {flash ? (
              <p
                role="status"
                className={cn(
                  "mb-2 text-center text-sm font-bold",
                  flash === "win" && "text-emerald-300",
                  flash === "loss" && "text-rose-300",
                  flash === "neutral" && "text-amber-200",
                )}
              >
                {flash === "win"
                  ? `Vitória! +${lastSettlement?.netProfit ?? 0} fichas`
                  : flash === "loss"
                    ? `Derrota. ${lastSettlement?.netProfit ?? 0} fichas`
                    : "Empate na ronda"}
              </p>
            ) : null}

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <RouletteSimulatorCountdownStrip
                phase={countdownStripPhase}
                countdownSec={spinClock.countdownSec}
                revealNumber={spinClock.revealNumber}
                revealNumberClassName={historyChipClass(spinClock.revealNumber ?? 0, true)}
              />
              <div className="relative min-h-0 flex-1">
                <RouletteSimulatorTapeteOverlay phase={spinClock.tapetePhase} />
                <div
                  ref={stageRef}
                  className={cn(
                    "min-h-0",
                    isFullscreen
                      ? "flex h-full items-center justify-center overflow-hidden"
                      : "overflow-x-auto",
                  )}
                >
                <div
                  className={cn("relative shrink-0", !isFullscreen && "mx-auto w-full")}
                style={
                  isFullscreen && fitReady
                    ? { width: fit.bw * fit.s, height: fit.bh * fit.s }
                    : undefined
                }
              >
                <div
                  className={cn(!isFullscreen && "mx-auto origin-top")}
                  style={
                    !isFullscreen
                      ? { transform: `scale(${inlineScale})`, transformOrigin: "top center" }
                      : undefined
                  }
                >
                  <div
                    ref={boardMeasureRef}
                    className={cn(
                      "mx-auto min-w-[min(100%,560px)] max-w-[720px] text-[11px] sm:text-xs",
                      isFullscreen && fitReady && "absolute left-0 top-0 will-change-transform",
                    )}
                    style={
                      isFullscreen && fitReady
                        ? {
                            width: fit.bw,
                            height: fit.bh,
                            transform: `scale(${fit.s})`,
                            transformOrigin: "top left",
                          }
                        : undefined
                    }
                  >
              <div className="flex items-stretch gap-0.5">
                <SimulatorBetCell
                  area={{ type: "straight", num: 0 }}
                  className={cn(
                    "flex w-9 shrink-0 items-stretch rounded-l-md border font-bold sm:w-11 sm:text-sm",
                    numberCellClass(0),
                  )}
                  chipAmount={getChipOn({ type: "straight", num: 0 })}
                  label="Nº 0"
                  resultPin={resultPin === 0}
                  betsLocked={betsLocked}
                  chipStyle="bottom"
                  chipDrag={chipDrag}
                  onPlace={(remove) => placeOnArea({ type: "straight", num: 0 }, remove)}
                >
                  <span className="relative flex flex-1 items-center justify-center">0</span>
                </SimulatorBetCell>

                <div className="flex min-w-0 flex-1 items-stretch">
                  {Array.from({ length: 12 }, (_, col) => {
                    const streetId = col + 1;
                    const top = 3 * (col + 1);
                    const mid = 3 * col + 2;
                    const bot = 3 * col + 1;
                    const streetArea = { type: "street" as const, id: streetId };
                    const streetChips = getChipOn(streetArea);

                    return (
                      <Fragment key={streetId}>
                        <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
                          {[top, mid, bot].map((n) => {
                            const straightArea = { type: "straight" as const, num: n };
                            return (
                              <SimulatorBetCell
                                key={n}
                                area={straightArea}
                                className={cn(
                                  "flex aspect-[5/4] min-h-[26px] items-center justify-center rounded-sm border font-bold tabular-nums sm:min-h-[30px] sm:text-xs",
                                  numberCellClass(n),
                                )}
                                chipAmount={getChipOn(straightArea)}
                                label={`Nº ${n}`}
                                resultPin={resultPin === n}
                                betsLocked={betsLocked}
                                chipStyle="bottom"
                                chipDrag={chipDrag}
                                onPlace={(remove) => placeOnArea(straightArea, remove)}
                              >
                                {n}
                              </SimulatorBetCell>
                            );
                          })}
                          <SimulatorBetCell
                            area={streetArea}
                            className="flex min-h-[14px] items-center justify-center rounded-sm border border-dashed border-slate-600/70 bg-slate-900/60 text-[7px] font-semibold uppercase tracking-wide text-slate-500 hover:border-amber-500/40 hover:text-amber-200/90 sm:min-h-[16px] sm:text-[8px]"
                            chipAmount={streetChips}
                            label={betAreaLabel(streetArea)}
                            betsLocked={betsLocked}
                            chipStyle="bottom"
                            chipDrag={chipDrag}
                            onPlace={(remove) => placeOnArea(streetArea, remove)}
                          >
                            rua
                          </SimulatorBetCell>
                        </div>
                        {col < 11 ? (
                          <SimulatorBetCell
                            area={{ type: "line", id: col + 1 }}
                            className="relative flex w-2 shrink-0 self-stretch items-center justify-center rounded-sm border border-dashed border-slate-600/50 bg-slate-900/40 hover:border-cyan-500/45 hover:bg-slate-800/70 sm:w-2.5"
                            chipAmount={getChipOn({ type: "line", id: col + 1 })}
                            label={betAreaLabel({ type: "line", id: col + 1 })}
                            betsLocked={betsLocked}
                            chipStyle="bottom"
                            chipDrag={chipDrag}
                            onPlace={(remove) => placeOnArea({ type: "line", id: col + 1 }, remove)}
                          >
                            <span className="sr-only">Linha {col + 1}</span>
                          </SimulatorBetCell>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              </div>

              <div className="mt-0.5 grid grid-cols-12 gap-0.5 pl-[calc(2.25rem+0.125rem)] sm:pl-[calc(2.75rem+0.125rem)]">
                {([1, 2, 3] as const).map((dozenId) => {
                  const dozenArea = { type: "dozen" as const, id: dozenId };
                  return (
                    <SimulatorBetCell
                      key={dozenId}
                      area={dozenArea}
                      className="col-span-4 flex min-h-[40px] items-center justify-center rounded-sm border border-slate-700 bg-emerald-950/40 py-2 font-semibold text-emerald-100/90"
                      onPlace={(remove) => placeOnArea(dozenArea, remove)}
                      chipAmount={getChipOn(dozenArea)}
                      label={`${dozenId}.ª 12`}
                      betsLocked={betsLocked}
                      chipDrag={chipDrag}
                    >
                      {dozenId}.ª 12
                    </SimulatorBetCell>
                  );
                })}
              </div>

              <div className="mt-0.5 grid grid-cols-12 gap-0.5 pl-[calc(2.25rem+0.125rem)] sm:pl-[calc(2.75rem+0.125rem)]">
                {(
                  [
                    { key: "low", label: "Baixo\n1–18", span: 2, area: { type: "low" } as const },
                    { key: "even", label: "PARES", span: 2, area: { type: "even" } as const },
                    { key: "red", label: "◆", span: 2, area: { type: "red" } as const, red: true },
                    { key: "black", label: "◆", span: 2, area: { type: "black" } as const, black: true },
                    { key: "odd", label: "ÍMPARES", span: 2, area: { type: "odd" } as const },
                    { key: "high", label: "Alto\n19–36", span: 2, area: { type: "high" } as const },
                  ] as const
                ).map((cell) => {
                  const base =
                    "relative flex min-h-[44px] items-center justify-center rounded-sm border py-2.5 font-semibold";
                  let cls = "border-slate-700 bg-slate-900/90 text-slate-200";
                  if ("red" in cell) cls = "border-red-500/40 bg-red-700/70 text-red-50";
                  if ("black" in cell) cls = "border-slate-600 bg-slate-800 text-slate-100";

                  return (
                    <SimulatorBetCell
                      key={cell.key}
                      area={cell.area}
                      className={cn(base, cls)}
                      style={{ gridColumn: `span ${cell.span} / span ${cell.span}` }}
                      onPlace={(remove) => placeOnArea(cell.area, remove)}
                      chipAmount={getChipOn(cell.area)}
                      label={betAreaLabel(cell.area)}
                      betsLocked={betsLocked}
                      chipDrag={chipDrag}
                    >
                      <span
                        className={cn(
                          "red" in cell || "black" in cell ? "text-lg" : "",
                          cell.key === "low" || cell.key === "high"
                            ? "whitespace-pre-line text-center leading-tight"
                            : "",
                        )}
                      >
                        {cell.label}
                      </span>
                    </SimulatorBetCell>
                  );
                })}
              </div>
                  </div>
                </div>
              </div>
              </div>
              </div>
            </div>

            <p className="mt-2 shrink-0 text-center text-[10px] text-slate-500 sm:text-[11px]">
              Clique para apostar · Shift+clique remove · Segure e arraste a ficha para mover · Linhas entre colunas =
              2 ruas (7×) · Aguarda o próximo giro de{" "}
              <span className="font-semibold text-slate-400">{tableName}</span>
            </p>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 p-3",
              isFullscreen ? "flex-nowrap" : "flex-wrap",
            )}
          >
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ficha</span>
              {ROULETTE_SIMULATOR_CHIP_VALUES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setChipValue(v)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-black transition",
                    chipValue === v
                      ? "border-amber-200 bg-amber-300 text-amber-950 ring-2 ring-cyan-400/50"
                      : "border-amber-100/80 bg-amber-200/90 text-amber-950 hover:scale-105",
                  )}
                  aria-pressed={chipValue === v}
                >
                  {v}
                </button>
              ))}
              <div className="flex flex-wrap items-center gap-2 border-l border-slate-700/70 pl-2">
                <button
                  type="button"
                  onClick={repeatBets}
                  disabled={!canRepeat}
                  title={canRepeat ? "Repetir última entrada" : "Sem entrada anterior ou saldo insuficiente"}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-700/50 bg-violet-950/45 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Repeat2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Repetir
                </button>
                <button
                  type="button"
                  onClick={doubleBets}
                  disabled={!canDouble}
                  title={canDouble ? "Dobrar apostas no tapete" : "Sem apostas ou saldo insuficiente"}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-900/45 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronsUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Dobrar
                </button>
                {!isFullscreen && lastRoundResult ? (
                  <div
                    role="status"
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-bold tabular-nums",
                      lastRoundResult.netProfit > 0
                        ? "border-emerald-600/50 bg-emerald-950/50 text-emerald-300"
                        : lastRoundResult.netProfit < 0
                          ? "border-rose-600/50 bg-rose-950/45 text-rose-300"
                          : "border-amber-600/45 bg-amber-950/40 text-amber-200",
                    )}
                  >
                    {lastRoundResult.netProfit > 0
                      ? `Venceu +${lastRoundResult.netProfit}`
                      : lastRoundResult.netProfit < 0
                        ? `Perdeu ${lastRoundResult.netProfit}`
                        : "Empate 0"}{" "}
                    <span className="font-semibold text-white/75">· nº {lastRoundResult.spin}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {isFullscreen ? (
              <div
                className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2"
                aria-label={`Últimos ${SIM_SPIN_HISTORY_LEN} giros de ${tableName}`}
              >
                {recentSpins.length === 0 ? (
                  <span className="whitespace-nowrap text-[10px] font-medium text-slate-500">
                    Aguardando giros…
                  </span>
                ) : (
                  recentSpins.map((n, i) => (
                    <span key={`${tableId}-fs-hist-${i}-${n}`} className={historyChipClass(n, i === 0)}>
                      {n}
                    </span>
                  ))
                )}
              </div>
            ) : null}

            <div className={cn("flex shrink-0 flex-wrap gap-2", !isFullscreen && "ml-auto")}>
              <button
                type="button"
                onClick={clearBets}
                disabled={totalStaked === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700/90 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Limpar apostas
              </button>
              <button
                type="button"
                onClick={resetSession}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700/90"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Reiniciar sessão
              </button>
            </div>
          </div>
        </div>

        <aside className={cn("flex flex-col gap-3", isFullscreen && "min-h-0 overflow-y-auto lg:overflow-y-auto")}>
          <div className="rounded-xl border border-cyan-800/50 bg-cyan-950/30 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-400/80">Saldo</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-white">{balance}</p>
            <p className="mt-1 text-xs text-slate-400">
              Em jogo: <span className="font-semibold text-amber-200">{totalStaked}</span> fichas
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Último giro ({tableName})</p>
            <p className="mt-2 text-4xl font-black tabular-nums text-white">{resultPin ?? "—"}</p>
            {lastSettlement ? (
              <p className="mt-2 text-xs text-slate-400">
                Ronda:{" "}
                <span
                  className={cn(
                    "font-bold",
                    lastSettlement.netProfit > 0
                      ? "text-emerald-400"
                      : lastSettlement.netProfit < 0
                        ? "text-rose-400"
                        : "text-amber-300",
                  )}
                >
                  {lastSettlement.netProfit > 0 ? "+" : ""}
                  {lastSettlement.netProfit} fichas
                </span>
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sessão</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Rondas</dt>
                <dd className="font-semibold tabular-nums text-white">{stats.roundsPlayed}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Apostas ganhas</dt>
                <dd className="font-semibold tabular-nums text-emerald-400">{stats.totalWins}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Apostas perdidas</dt>
                <dd className="font-semibold tabular-nums text-rose-400">{stats.totalLosses}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Total apostado</dt>
                <dd className="font-semibold tabular-nums text-slate-200">{stats.totalWagered}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-slate-800/80 pt-2">
                <dt className="text-slate-300">Lucro líquido</dt>
                <dd
                  className={cn(
                    "font-bold tabular-nums",
                    stats.netProfit > 0 ? "text-emerald-400" : stats.netProfit < 0 ? "text-rose-400" : "text-white",
                  )}
                >
                  {stats.netProfit > 0 ? "+" : ""}
                  {stats.netProfit}
                </dd>
              </div>
            </dl>
          </div>

          {placedBets.length > 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Apostas activas</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                {placedBets.map((b) => (
                  <li key={betAreaKey(b.area)} className="flex justify-between gap-2 text-slate-300">
                    <span>{betAreaLabel(b.area)}</span>
                    <span className="shrink-0 tabular-nums">
                      {b.chips} ({betPayoutMultiplier(b.area)}×)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {lastSettlement && lastSettlement.lines.length > 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Última liquidação</p>
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
                {lastSettlement.lines.map((line) => (
                  <li
                    key={betAreaKey(line.area)}
                    className={cn(
                      "flex justify-between gap-2",
                      line.won ? "text-emerald-300" : "text-rose-300/90",
                    )}
                  >
                    <span>{betAreaLabel(line.area)}</span>
                    <span className="shrink-0 tabular-nums">
                      {line.won ? `+${line.net}` : line.net}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
