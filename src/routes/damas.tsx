import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { DamasLobbyGrid } from "@/components/damas/DamasLobbyGrid";
import { DamasLiveRoom, damasLoadSecret, damasLoadSeat, damasSaveSecret, damasSaveSeat } from "@/components/damas/DamasLiveRoom";
import { isDamasFixedLobbyRoomId, isDamasVipRoomId } from "@/lib/damas/fixedRooms";
import type { DamasPublicState } from "@/lib/damas/types";

export const Route = createFileRoute("/damas")({
  validateSearch: (search: Record<string, unknown>): { room?: string } => {
    const raw = search.room;
    if (raw === undefined || raw === null || raw === "") return {};
    const s = String(raw).trim();
    if (s === "sala-1" || s === "sala-2" || s === "sala-vip") return { room: s };
    if (s.length < 4) return {};
    return { room: s };
  },
  head: () => ({
    meta: [
      { title: "Damas ao vivo" },
      {
        name: "description",
        content: "Partidas de damas online entre dois jogadores, em tempo real.",
      },
    ],
  }),
  component: DamasPage,
});

function DamasPage() {
  const { room } = Route.useSearch();
  const navigate = useNavigate();
  const [hostName, setHostName] = useState("");
  const [joinRoom, setJoinRoom] = useState("");
  const [guestName, setGuestName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publicState, setPublicState] = useState<DamasPublicState | null>(null);

  const refetchPublicState = async (roomId: string) => {
    try {
      const url = new URL("/api/damas", window.location.origin);
      url.searchParams.set("roomId", roomId);
      const sec = damasLoadSecret(roomId);
      if (sec) url.searchParams.set("secret", sec);
      const res = await fetch(url.href);
      if (!res.ok) return;
      const j = (await res.json()) as DamasPublicState | { error?: string };
      if (!("error" in j && j.error)) setPublicState(j as DamasPublicState);
    } catch {
      /* */
    }
  };

  useEffect(() => {
    if (!room || isDamasVipRoomId(room)) {
      setPublicState(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const url = new URL("/api/damas", window.location.origin);
        url.searchParams.set("roomId", room);
        const sec = damasLoadSecret(room);
        if (sec) url.searchParams.set("secret", sec);
        const res = await fetch(url.href);
        const j = (await res.json()) as DamasPublicState | { error?: string };
        if (!cancelled && !("error" in j && j.error)) setPublicState(j as DamasPublicState);
      } catch {
        if (!cancelled) setPublicState(null);
      }
    };
    void load();
    const t = setInterval(() => void load(), 3200);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [room]);

  const createRoom = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/damas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", hostName }),
      });
      const j = (await res.json()) as { roomId?: string; hostSecret?: string; error?: string };
      if (!res.ok || !j.roomId || !j.hostSecret) {
        setMsg(j.error ?? "Não foi possível criar a sala.");
        return;
      }
      damasSaveSecret(j.roomId, j.hostSecret);
      damasSaveSeat(j.roomId, 0);
      await navigate({ to: "/damas", search: { room: j.roomId } });
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setLoading(false);
    }
  };

  const takeHostFixed = async (roomId: string) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/damas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "takeHost", roomId, hostName }),
      });
      const j = (await res.json()) as { hostSecret?: string; error?: string };
      if (!res.ok || !j.hostSecret) {
        setMsg(j.error ?? "Não foi possível ocupar a sala.");
        return;
      }
      damasSaveSecret(roomId, j.hostSecret);
      damasSaveSeat(roomId, 0);
      await refetchPublicState(roomId);
      await navigate({ to: "/damas", search: { room: roomId } });
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setLoading(false);
    }
  };

  const joinRoomFn = async () => {
    setLoading(true);
    setMsg(null);
    const id = joinRoom.trim();
    if (!id) {
      setMsg("Indica o código da sala.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/damas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", roomId: id, guestName }),
      });
      const j = (await res.json()) as { guestSecret?: string; error?: string };
      if (!res.ok || !j.guestSecret) {
        setMsg(j.error ?? "Não foi possível entrar.");
        return;
      }
      damasSaveSecret(id, j.guestSecret);
      damasSaveSeat(id, 1);
      await refetchPublicState(id);
      await navigate({ to: "/damas", search: { room: id } });
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setLoading(false);
    }
  };

  const joinCurrentRoomAsGuest = async (roomId: string) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/damas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", roomId, guestName }),
      });
      const j = (await res.json()) as { guestSecret?: string; error?: string };
      if (!res.ok || !j.guestSecret) {
        setMsg(j.error ?? "Não foi possível entrar.");
        return;
      }
      damasSaveSecret(roomId, j.guestSecret);
      damasSaveSeat(roomId, 1);
      await refetchPublicState(roomId);
      await navigate({ to: "/damas", search: { room: roomId } });
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setLoading(false);
    }
  };

  const inviteUrl =
    typeof window !== "undefined" && room
      ? `${window.location.origin}/damas?room=${encodeURIComponent(room)}`
      : "";

  const mySecret = room ? damasLoadSecret(room) : null;
  const mySeat = room ? damasLoadSeat(room) : null;
  const inGameWithToken = Boolean(room && mySecret && mySeat !== null && publicState && !publicState.lobbyEmpty);

  return (
    <div className="min-h-screen bg-[#080d18] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Damas ao vivo</h1>
            <p className="mt-1 text-sm text-slate-400">
              Salas 1 e 2 partilhadas; convida o adversário pelo link. A Sala VIP terá regras próprias (em
              configuração).
            </p>
          </div>
          <Link
            to="/"
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-cyan-500/50 hover:text-white"
          >
            ← Lobby
          </Link>
        </div>

        {msg ? (
          <p className="mb-4 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {msg}
          </p>
        ) : null}

        {!room ? (
          <div className="space-y-10">
            <DamasLobbyGrid />
            <div className="border-t border-slate-800 pt-8">
              <p className="mb-4 text-center text-sm text-slate-500">Sala privada (código gerado)</p>
              <div className="grid gap-8 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                  <h2 className="text-lg font-semibold text-white">Criar sala</h2>
                  <p className="mt-1 text-xs text-slate-500">Jogas com as peças vermelhas (topo).</p>
                  <label className="mt-4 block text-xs font-medium text-slate-400" htmlFor="damas-host">
                    O teu nome
                  </label>
                  <input
                    id="damas-host"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="Visitante"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    className="mt-4 w-full rounded-lg bg-cyan-600 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-500 disabled:opacity-50"
                    onClick={() => void createRoom()}
                  >
                    Criar e abrir sala
                  </button>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                  <h2 className="text-lg font-semibold text-white">Entrar numa sala</h2>
                  <p className="mt-1 text-xs text-slate-500">Código que o anfitrião partilhou.</p>
                  <label className="mt-4 block text-xs font-medium text-slate-400" htmlFor="damas-room">
                    Código da sala
                  </label>
                  <input
                    id="damas-room"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm"
                    value={joinRoom}
                    onChange={(e) => setJoinRoom(e.target.value)}
                    placeholder="abc123…"
                  />
                  <label className="mt-4 block text-xs font-medium text-slate-400" htmlFor="damas-guest">
                    O teu nome
                  </label>
                  <input
                    id="damas-guest"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Visitante 2"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    className="mt-4 w-full rounded-lg border border-cyan-600/50 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
                    onClick={() => void joinRoomFn()}
                  >
                    Entrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : isDamasVipRoomId(room) ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-6 py-12 text-center">
            <p className="text-lg font-semibold text-amber-100">Sala VIP</p>
            <p className="mt-2 text-sm text-amber-200/80">
              Funcionamento programado — poderás configurar regras e acesso aqui mais tarde.
            </p>
            <Link
              to="/damas"
              className="mt-6 inline-block rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
              search={{}}
            >
              Voltar às salas
            </Link>
          </div>
        ) : inGameWithToken ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="font-mono text-xs text-slate-500">
              Sala: <span className="text-cyan-300">{room}</span>
            </p>
            {inviteUrl ? (
              <p className="mt-2 break-all text-xs text-slate-400">
                Convite:{" "}
                <a className="text-cyan-400 underline" href={inviteUrl}>
                  {inviteUrl}
                </a>
              </p>
            ) : null}
            <div className="mt-6">
              <DamasLiveRoom roomId={room} />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="font-mono text-xs text-slate-500">
              Sala: <span className="text-cyan-300">{room}</span>
            </p>
            {publicState?.lobbyEmpty && isDamasFixedLobbyRoomId(room) ? (
              <div className="mt-6 max-w-sm">
                <p className="text-sm text-slate-400">Esta sala está vazia. Ocupa o lugar das peças vermelhas.</p>
                <label className="mt-4 block text-xs font-medium text-slate-400" htmlFor="damas-host-fixed">
                  O teu nome
                </label>
                <input
                  id="damas-host-fixed"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Visitante"
                />
                <button
                  type="button"
                  disabled={loading}
                  className="mt-4 w-full rounded-lg bg-cyan-600 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-500 disabled:opacity-50"
                  onClick={() => void takeHostFixed(room)}
                >
                  Entrar como anfitrião
                </button>
              </div>
            ) : publicState && !publicState.guestName && !publicState.lobbyEmpty ? (
              <div className="mt-6 max-w-sm">
                <p className="text-sm text-slate-400">
                  <span className="font-medium text-slate-200">{publicState.hostName}</span> está à espera de
                  adversário.
                </p>
                <label className="mt-4 block text-xs font-medium text-slate-400" htmlFor="damas-guest-fixed">
                  O teu nome
                </label>
                <input
                  id="damas-guest-fixed"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Visitante 2"
                />
                <button
                  type="button"
                  disabled={loading}
                  className="mt-4 w-full rounded-lg border border-cyan-600/50 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
                  onClick={() => void joinCurrentRoomAsGuest(room)}
                >
                  Entrar como convidado (brancas)
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">A carregar estado da sala…</p>
            )}
            {inviteUrl ? (
              <p className="mt-6 break-all text-xs text-slate-500">
                Convite: <span className="text-cyan-500/90">{inviteUrl}</span>
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
