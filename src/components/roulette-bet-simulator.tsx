import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Trash2, X, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CHIP_VALUES,
  DEFAULT_BANKROLL,
  RED_NUMBERS,
  freshState,
  readSimulatorState,
  resolveBets,
  writeSimulatorState,
  type BetKey,
  type Bets,
  type SimulatorState,
} from "@/lib/roulette/betSimulator";

interface Props {
  tableId: number;
  history: number[]; // newest first
  open: boolean;
  onClose: () => void;
}

const ROW1 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
const ROW2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
const ROW3 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

function numColor(n: number): string {
  if (n === 0) return "bg-emerald-700";
  return RED_NUMBERS.has(n) ? "bg-red-600" : "bg-slate-900";
}

const chipColors: Record<number, string> = {
  1: "bg-white text-slate-900 border-slate-400",
  5: "bg-red-600 text-white border-red-300",
  25: "bg-green-600 text-white border-green-300",
  100: "bg-slate-900 text-white border-slate-400",
};

export function RouletteBetSimulator({ tableId, history, open, onClose }: Props) {
  const [state, setState] = useState<SimulatorState>(() => readSimulatorState(tableId));
  const [chip, setChip] = useState<number>(CHIP_VALUES[1]!);
  const [flash, setFlash] = useState<{ spin: number; net: number } | null>(null);
  const flashTimer = useRef<number | null>(null);

  // Reload state when table changes
  useEffect(() => {
    setState(readSimulatorState(tableId));
  }, [tableId]);

  // Persist
  useEffect(() => {
    writeSimulatorState(tableId, state);
  }, [tableId, state]);

  // Auto-resolve when a new spin arrives
  const newestSpin = history.length > 0 ? history[0]! : null;
  useEffect(() => {
    if (newestSpin === null) return;
    setState((prev) => {
      if (prev.lastSpinProcessed === newestSpin && Object.keys(prev.bets).length === 0) {
        // already processed this spin and no bets to resolve
        return prev;
      }
      if (prev.lastSpinProcessed === newestSpin) {
        // same spin, but bets exist; don't double-resolve
        return prev;
      }
      const totalBets = Object.values(prev.bets).reduce((a, b) => a + b, 0);
      if (totalBets <= 0) {
        return { ...prev, lastSpinProcessed: newestSpin };
      }
      const { totalStake, totalReturn, net } = resolveBets(prev.bets, newestSpin);
      const isWin = net > 0;
      setFlash({ spin: newestSpin, net });
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 4000);
      return {
        ...prev,
        bankroll: prev.bankroll + net,
        bets: {},
        lastSpinProcessed: newestSpin,
        wins: prev.wins + (isWin ? 1 : 0),
        losses: prev.losses + (isWin ? 0 : 1),
        history: [
          { spin: newestSpin, stake: totalStake, ret: totalReturn, net, ts: Date.now() },
          ...prev.history,
        ].slice(0, 50),
      };
    });
  }, [newestSpin]);

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const totalBet = useMemo(
    () => Object.values(state.bets).reduce((a, b) => a + b, 0),
    [state.bets],
  );

  const placeBet = useCallback(
    (key: BetKey) => {
      setState((prev) => {
        if (prev.bankroll - totalBetOf(prev.bets) < chip) return prev;
        return { ...prev, bets: { ...prev.bets, [key]: (prev.bets[key] ?? 0) + chip } };
      });
    },
    [chip],
  );

  const removeBet = useCallback((key: BetKey, ev: React.MouseEvent) => {
    ev.preventDefault();
    setState((prev) => {
      const cur = prev.bets[key] ?? 0;
      if (cur <= 0) return prev;
      const next = { ...prev.bets };
      const after = cur - chip;
      if (after <= 0) delete next[key];
      else next[key] = after;
      return { ...prev, bets: next };
    });
  }, [chip]);

  const clearBets = useCallback(() => {
    setState((p) => ({ ...p, bets: {} }));
  }, []);

  const resetAll = useCallback(() => {
    if (!window.confirm("Repor banca e estatísticas?")) return;
    setState({ ...freshState(), lastSpinProcessed: newestSpin });
  }, [newestSpin]);

  if (!open) return null;

  const available = state.bankroll - totalBet;
  const pl = state.bankroll - DEFAULT_BANKROLL;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[50] flex items-center justify-center bg-black/75 p-2 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[96vh] w-[min(1080px,98vw)] overflow-y-auto rounded-xl border border-slate-700 bg-[#0b1320] p-3 text-slate-100 shadow-2xl sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-400" aria-hidden />
            <h2 className="text-sm font-bold sm:text-base">Simulador de apostas — Mesa {tableId}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
            <span className="font-semibold text-emerald-300">Banca: {state.bankroll.toLocaleString()}</span>
            <span className="text-slate-400">Disp: {available.toLocaleString()}</span>
            <span className={cn("font-semibold", pl >= 0 ? "text-emerald-400" : "text-red-400")}>
              P/L: {pl >= 0 ? "+" : ""}
              {pl.toLocaleString()}
            </span>
            <span className="text-slate-400">
              V/D: <span className="text-emerald-400">{state.wins}</span>/
              <span className="text-red-400">{state.losses}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 bg-slate-900 p-1.5 hover:bg-slate-800"
              aria-label="Fechar simulador"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {flash ? (
          <div
            className={cn(
              "mb-2 rounded-md border px-3 py-1.5 text-center text-xs font-semibold sm:text-sm",
              flash.net > 0
                ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-200"
                : flash.net < 0
                  ? "border-red-500/50 bg-red-950/60 text-red-200"
                  : "border-slate-600 bg-slate-900/60 text-slate-200",
            )}
          >
            Resultado {flash.spin}: {flash.net > 0 ? "+" : ""}
            {flash.net.toLocaleString()}
          </div>
        ) : null}

        {/* Chips */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">Ficha</span>
          {CHIP_VALUES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setChip(v)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold shadow",
                chipColors[v],
                chip === v ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0b1320]" : "opacity-80",
              )}
            >
              {v}
            </button>
          ))}
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={clearBets}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs hover:bg-slate-800"
            >
              <Trash2 className="h-3.5 w-3.5" /> Limpar apostas
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1 rounded-md border border-amber-700/60 bg-amber-950/40 px-2 py-1 text-xs text-amber-100 hover:bg-amber-900/50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Repor tudo
            </button>
          </div>
        </div>
        <p className="mb-2 text-[10px] text-slate-500">
          Clique para apostar a ficha selecionada · clique-direito para remover · resolve no próximo giro real desta mesa.
        </p>

        {/* Tapete */}
        <div className="overflow-x-auto rounded-lg border border-emerald-900/50 bg-emerald-950/40 p-1.5">
          <div className="flex min-w-[640px] gap-1">
            {/* Zero */}
            <BetCell
              betKey="n:0"
              bets={state.bets}
              onPlace={placeBet}
              onRemove={removeBet}
              className={cn("w-10 min-h-[120px] text-base", numColor(0))}
            >
              0
            </BetCell>

            <div className="flex flex-col gap-1">
              {/* Row 1 (top) */}
              <div className="flex gap-1">
                {ROW1.map((n) => (
                  <BetCell
                    key={n}
                    betKey={`n:${n}` as BetKey}
                    bets={state.bets}
                    onPlace={placeBet}
                    onRemove={removeBet}
                    className={cn("h-10 w-10 text-sm", numColor(n))}
                  >
                    {n}
                  </BetCell>
                ))}
                <BetCell
                  betKey="col:3"
                  bets={state.bets}
                  onPlace={placeBet}
                  onRemove={removeBet}
                  className="h-10 w-14 bg-slate-800 text-[10px]"
                >
                  2:1
                </BetCell>
              </div>
              <div className="flex gap-1">
                {ROW2.map((n) => (
                  <BetCell
                    key={n}
                    betKey={`n:${n}` as BetKey}
                    bets={state.bets}
                    onPlace={placeBet}
                    onRemove={removeBet}
                    className={cn("h-10 w-10 text-sm", numColor(n))}
                  >
                    {n}
                  </BetCell>
                ))}
                <BetCell
                  betKey="col:2"
                  bets={state.bets}
                  onPlace={placeBet}
                  onRemove={removeBet}
                  className="h-10 w-14 bg-slate-800 text-[10px]"
                >
                  2:1
                </BetCell>
              </div>
              <div className="flex gap-1">
                {ROW3.map((n) => (
                  <BetCell
                    key={n}
                    betKey={`n:${n}` as BetKey}
                    bets={state.bets}
                    onPlace={placeBet}
                    onRemove={removeBet}
                    className={cn("h-10 w-10 text-sm", numColor(n))}
                  >
                    {n}
                  </BetCell>
                ))}
                <BetCell
                  betKey="col:1"
                  bets={state.bets}
                  onPlace={placeBet}
                  onRemove={removeBet}
                  className="h-10 w-14 bg-slate-800 text-[10px]"
                >
                  2:1
                </BetCell>
              </div>
              {/* Dozens */}
              <div className="flex gap-1">
                <BetCell
                  betKey="doz:1"
                  bets={state.bets}
                  onPlace={placeBet}
                  onRemove={removeBet}
                  className="h-9 flex-1 bg-slate-800 text-xs"
                >
                  1ª 12
                </BetCell>
                <BetCell
                  betKey="doz:2"
                  bets={state.bets}
                  onPlace={placeBet}
                  onRemove={removeBet}
                  className="h-9 flex-1 bg-slate-800 text-xs"
                >
                  2ª 12
                </BetCell>
                <BetCell
                  betKey="doz:3"
                  bets={state.bets}
                  onPlace={placeBet}
                  onRemove={removeBet}
                  className="h-9 flex-1 bg-slate-800 text-xs"
                >
                  3ª 12
                </BetCell>
                <div className="w-14" />
              </div>
              {/* Outside */}
              <div className="flex gap-1">
                <BetCell betKey="low" bets={state.bets} onPlace={placeBet} onRemove={removeBet} className="h-9 flex-1 bg-slate-800 text-xs">1-18</BetCell>
                <BetCell betKey="even" bets={state.bets} onPlace={placeBet} onRemove={removeBet} className="h-9 flex-1 bg-slate-800 text-xs">PAR</BetCell>
                <BetCell betKey="red" bets={state.bets} onPlace={placeBet} onRemove={removeBet} className="h-9 flex-1 bg-red-600 text-xs">VERMELHO</BetCell>
                <BetCell betKey="black" bets={state.bets} onPlace={placeBet} onRemove={removeBet} className="h-9 flex-1 bg-slate-900 text-xs">PRETO</BetCell>
                <BetCell betKey="odd" bets={state.bets} onPlace={placeBet} onRemove={removeBet} className="h-9 flex-1 bg-slate-800 text-xs">ÍMPAR</BetCell>
                <BetCell betKey="high" bets={state.bets} onPlace={placeBet} onRemove={removeBet} className="h-9 flex-1 bg-slate-800 text-xs">19-36</BetCell>
                <div className="w-14" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Total apostado: <span className="font-semibold text-slate-100">{totalBet.toLocaleString()}</span>
          </span>
          <span className="text-slate-400">
            Aguardando giro: <span className="font-semibold text-slate-100">{newestSpin ?? "—"}</span>
          </span>
        </div>

        {/* History */}
        {state.history.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Últimas rodadas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {state.history.slice(0, 20).map((h, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[10px] font-mono",
                    h.net > 0
                      ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-300"
                      : h.net < 0
                        ? "border-red-700/60 bg-red-950/40 text-red-300"
                        : "border-slate-700 bg-slate-900 text-slate-300",
                  )}
                  title={`stake ${h.stake} · retorno ${h.ret}`}
                >
                  {h.spin}: {h.net > 0 ? "+" : ""}{h.net}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function totalBetOf(bets: Bets): number {
  let s = 0;
  for (const v of Object.values(bets)) s += v;
  return s;
}

interface BetCellProps {
  betKey: BetKey;
  bets: Bets;
  onPlace: (k: BetKey) => void;
  onRemove: (k: BetKey, e: React.MouseEvent) => void;
  className?: string;
  children: React.ReactNode;
}

function BetCell({ betKey, bets, onPlace, onRemove, className, children }: BetCellProps) {
  const amount = bets[betKey] ?? 0;
  return (
    <button
      type="button"
      onClick={() => onPlace(betKey)}
      onContextMenu={(e) => onRemove(betKey, e)}
      className={cn(
        "relative flex items-center justify-center rounded-sm font-bold text-white shadow-inner transition hover:brightness-125 active:brightness-90",
        className,
      )}
    >
      <span className="select-none">{children}</span>
      {amount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-slate-900 bg-amber-400 px-1 text-[10px] font-bold text-slate-900 shadow">
          {amount}
        </span>
      ) : null}
    </button>
  );
}
