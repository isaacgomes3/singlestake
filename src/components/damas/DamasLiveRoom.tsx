import { useEffect, useState } from "react";

import type { DamasOwner, DamasPublicState, Pos } from "@/lib/damas/types";

const STORAGE_PREFIX = "damas.secret.";

export function damasSaveSecret(roomId: string, secret: string): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + roomId, secret);
  } catch {
    /* */
  }
}

export function damasLoadSecret(roomId: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + roomId);
  } catch {
    return null;
  }
}

const SEAT_PREFIX = "damas.seat.";

export function damasSaveSeat(roomId: string, seat: DamasOwner): void {
  try {
    sessionStorage.setItem(SEAT_PREFIX + roomId, String(seat));
  } catch {
    /* */
  }
}

export function damasLoadSeat(roomId: string): DamasOwner | null {
  try {
    const v = sessionStorage.getItem(SEAT_PREFIX + roomId);
    if (v === "0") return 0;
    if (v === "1") return 1;
    return null;
  } catch {
    return null;
  }
}

function ownerLabel(o: DamasOwner): string {
  return o === 0 ? "Vermelhas (topo)" : "Brancas (fundo)";
}

export function DamasLiveRoom({ roomId }: { roomId: string }) {
  const [state, setState] = useState<DamasPublicState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [busy, setBusy] = useState(false);

  const secret = damasLoadSecret(roomId);

  useEffect(() => {
    let es: EventSource | null = null;
    const url = new URL("/api/damas", window.location.origin);
    url.searchParams.set("stream", "1");
    url.searchParams.set("roomId", roomId);
    if (secret) url.searchParams.set("secret", secret);
    es = new EventSource(url.href);
    es.onmessage = (ev) => {
      try {
        const o = JSON.parse(ev.data) as { type?: string; state?: DamasPublicState };
        if (o.type === "state" && o.state) {
          const fixedSeat = damasLoadSeat(roomId);
          setState({
            ...o.state,
            seat: fixedSeat !== null ? fixedSeat : o.state.seat,
          });
        }
      } catch {
        /* */
      }
    };
    es.onerror = () => {
      setError("Ligação em tempo real interrompida. Recarregue a página.");
    };
    return () => {
      es?.close();
    };
  }, [roomId, secret]);

  const seat = state?.seat ?? null;
  const myTurn = seat !== null && state && state.turn === seat && !state.winner;
  const mustFrom = state?.mustContinueFrom;

  const onCellClick = async (r: number, c: number) => {
    if (!state || !secret || seat === null || busy || state.winner) return;
    if (state.turn !== seat) return;
    if (mustFrom && (mustFrom.r !== r || mustFrom.c !== c)) {
      setSelected(null);
      return;
    }
    const cell = state.board[r]?.[c];
    if (selected === null) {
      if (cell && cell.owner === seat) setSelected({ r, c });
      return;
    }
    if (selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/damas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          roomId,
          secret,
          from: [selected.r, selected.c],
          to: [r, c],
        }),
      });
      const j = (await res.json()) as { error?: string; state?: DamasPublicState };
      if (!res.ok) {
        setError(j.error ?? "Jogada recusada.");
        if (j.state) setState(j.state);
      } else if (j.state) setState(j.state);
      setSelected(null);
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(false);
    }
  };

  if (!secret) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Não foi encontrado o token desta sala neste dispositivo. Entre de novo pelo convite ou crie uma nova
        sala.
      </div>
    );
  }

  if (!state) {
    return <p className="text-slate-400">A carregar sala…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
        <p>
          <span className="font-semibold text-white">{state.hostName}</span> vs{" "}
          <span className="font-semibold text-white">{state.guestName ?? "…"}</span>
        </p>
        <p className="text-slate-400">
          Você: <span className="text-cyan-300">{ownerLabel(seat!)}</span>
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {state.winner !== null ? (
        <p className="text-lg font-semibold text-emerald-300">
          {state.winner === "draw"
            ? "Empate."
            : state.winner === seat
              ? "Ganhaste!"
              : "Vitória do adversário."}
        </p>
      ) : (
        <p className="text-sm text-slate-400">
          {myTurn
            ? mustFrom
              ? "Continuação de captura: tens de jogar com a peça marcada."
              : "É a tua vez."
            : "Aguarda o adversário."}
        </p>
      )}

      <div
        className="inline-grid gap-0 rounded-lg border border-slate-700 p-1"
        style={{ gridTemplateColumns: "repeat(8, minmax(0, 2.5rem))" }}
      >
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8);
          const c = i % 8;
          const dark = (r + c) % 2 === 1;
          const piece = state.board[r]![c];
          const isSel = selected && selected.r === r && selected.c === c;
          const mustHere = mustFrom && mustFrom.r === r && mustFrom.c === c;
          return (
            <button
              key={`${r}-${c}`}
              type="button"
              disabled={!dark || busy}
              onClick={() => void onCellClick(r, c)}
              className={`flex h-10 w-10 items-center justify-center text-xs font-bold sm:h-11 sm:w-11 ${
                dark ? "bg-amber-900/50" : "cursor-default bg-slate-900/80"
              } ${isSel ? "ring-2 ring-cyan-400" : ""} ${mustHere ? "ring-2 ring-amber-400" : ""}`}
            >
              {piece ? (
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                    piece.owner === 0
                      ? "border-red-300 bg-red-700/90 text-white"
                      : "border-slate-200 bg-slate-100 text-slate-900"
                  } ${piece.king ? "ring-2 ring-yellow-400" : ""}`}
                >
                  {piece.king ? "D" : ""}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="max-w-md text-xs text-slate-500">
        Pedras só avançam na diagonal para o lado adversário; capturas são obrigatórias quando existem.
        Dama = peça coroada nas últimas filas.
      </p>
    </div>
  );
}