import { randomBytes } from "node:crypto";

import {
  DAMAS_FIXED_LOBBY_ROOM_IDS,
  DAMAS_LOBBY_SALA_1,
  DAMAS_LOBBY_SALA_2,
  DAMAS_LOBBY_SALA_VIP,
  isDamasVipRoomId,
} from "@/lib/damas/fixedRooms";
import {
  applyMove,
  countPieces,
  createInitialBoard,
  findMatchingMove,
  listLegalMoves,
  mustContinueCapture,
  other,
} from "@/lib/damas/engine";
import type { DamasBoard, DamasLobbySlotSnapshot, DamasOwner, DamasPublicState, Pos } from "@/lib/damas/types";

type InternalRoom = {
  roomId: string;
  /** `null` = sala fixa ainda sem anfitrião. */
  hostSecret: string | null;
  guestSecret: string | null;
  hostName: string | null;
  guestName: string | null;
  board: DamasBoard;
  turn: DamasOwner;
  winner: DamasOwner | "draw" | null;
  mustContinueFrom: Pos | null;
  version: number;
};

const rooms = new Map<string, InternalRoom>();

const enc = new TextEncoder();

function sseBytes(obj: unknown): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

const streamControllers = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();

function roomStreamKey(roomId: string): string {
  return roomId;
}

export function damasSubscribeRoom(
  roomId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): () => void {
  let set = streamControllers.get(roomStreamKey(roomId));
  if (!set) {
    set = new Set();
    streamControllers.set(roomStreamKey(roomId), set);
  }
  set.add(controller);
  return () => {
    set!.delete(controller);
    if (set!.size === 0) streamControllers.delete(roomStreamKey(roomId));
  };
}

export function damasBroadcastRoom(roomId: string, payload: unknown): void {
  const bytes = sseBytes(payload);
  for (const c of streamControllers.get(roomStreamKey(roomId)) ?? []) {
    try {
      c.enqueue(bytes);
    } catch {
      /* */
    }
  }
}

function randomId(len: number): string {
  return randomBytes(len).toString("hex").slice(0, len);
}

function emptySlotRoom(roomId: string): InternalRoom {
  return {
    roomId,
    hostSecret: null,
    guestSecret: null,
    hostName: null,
    guestName: null,
    board: createInitialBoard(),
    turn: 0,
    winner: null,
    mustContinueFrom: null,
    version: 0,
  };
}

function ensureFixedSlots(): void {
  for (const id of DAMAS_FIXED_LOBBY_ROOM_IDS) {
    if (!rooms.has(id)) rooms.set(id, emptySlotRoom(id));
  }
}

ensureFixedSlots();

function slotLabel(roomId: string): string {
  if (roomId === DAMAS_LOBBY_SALA_1) return "Sala 1";
  if (roomId === DAMAS_LOBBY_SALA_2) return "Sala 2";
  return roomId;
}

function computeFooterStatus(
  r: InternalRoom,
): "Vazia" | "Aguardando jogador" | "Em jogo" | "Partida terminada" {
  if (!r.hostSecret) return "Vazia";
  if (!r.guestSecret) return "Aguardando jogador";
  if (r.winner !== null) return "Partida terminada";
  return "Em jogo";
}

export function damasGetLobbySlots(): DamasLobbySlotSnapshot[] {
  ensureFixedSlots();
  const out: DamasLobbySlotSnapshot[] = [];
  for (const id of DAMAS_FIXED_LOBBY_ROOM_IDS) {
    const r = rooms.get(id)!;
    const playerCount = ((r.hostSecret ? 1 : 0) + (r.guestSecret ? 1 : 0)) as 0 | 1 | 2;
    out.push({
      kind: "slot",
      roomId: id,
      label: slotLabel(id),
      playerCount,
      footerStatus: computeFooterStatus(r),
      hostName: r.hostName,
      guestName: r.guestName,
      version: r.version,
    });
  }
  out.push({
    kind: "vip",
    roomId: DAMAS_LOBBY_SALA_VIP,
    label: "Sala VIP",
    footerStatus: "Programado — em breve",
  });
  return out;
}

export function damasGetSlotSnapshot(roomId: string): DamasLobbySlotSnapshot | null {
  if (isDamasVipRoomId(roomId)) {
    return {
      kind: "vip",
      roomId: DAMAS_LOBBY_SALA_VIP,
      label: "Sala VIP",
      footerStatus: "Programado — em breve",
    };
  }
  ensureFixedSlots();
  const r = rooms.get(roomId);
  if (!r) return null;
  const playerCount = ((r.hostSecret ? 1 : 0) + (r.guestSecret ? 1 : 0)) as 0 | 1 | 2;
  return {
    kind: "slot",
    roomId,
    label: slotLabel(roomId),
    playerCount,
    footerStatus: computeFooterStatus(r),
    hostName: r.hostName,
    guestName: r.guestName,
    version: r.version,
  };
}

function toPublic(room: InternalRoom, seat: DamasOwner | null): DamasPublicState {
  return {
    roomId: room.roomId,
    seat,
    hostName: room.hostName ?? "",
    guestName: room.guestName,
    board: room.board,
    turn: room.turn,
    winner: room.winner,
    mustContinueFrom: room.mustContinueFrom,
    version: room.version,
    lobbyEmpty: !room.hostSecret,
  };
}

/** Anfitrião ocupa uma sala fixa (sala-1 / sala-2). */
export function damasTakeHostSlot(
  roomId: string,
  hostName: string,
): { ok: true; hostSecret: string } | { ok: false; error: string } {
  if (isDamasVipRoomId(roomId)) return { ok: false, error: "Sala VIP: funcionamento programado — em breve." };
  ensureFixedSlots();
  const room = rooms.get(roomId);
  if (!room) return { ok: false, error: "Sala não encontrada." };
  if (room.hostSecret) return { ok: false, error: "Já existe um anfitrião nesta sala." };
  room.hostSecret = randomId(24);
  room.hostName = hostName.trim() || "Jogador 1";
  room.guestSecret = null;
  room.guestName = null;
  room.board = createInitialBoard();
  room.turn = 0;
  room.winner = null;
  room.mustContinueFrom = null;
  room.version++;
  damasBroadcastRoom(roomId, { type: "state", state: toPublic(room, null) });
  return { ok: true, hostSecret: room.hostSecret };
}

export function damasCreateRoom(hostName: string): { roomId: string; hostSecret: string } {
  const roomId = randomId(10);
  const hostSecret = randomId(24);
  const room: InternalRoom = {
    roomId,
    hostSecret,
    guestSecret: null,
    hostName: hostName.trim() || "Jogador 1",
    guestName: null,
    board: createInitialBoard(),
    turn: 0,
    winner: null,
    mustContinueFrom: null,
    version: 1,
  };
  rooms.set(roomId, room);
  return { roomId, hostSecret };
}

export function damasJoinRoom(
  roomId: string,
  guestName: string,
): { ok: true; guestSecret: string } | { ok: false; error: string } {
  if (isDamasVipRoomId(roomId)) return { ok: false, error: "Sala VIP: em breve." };
  const room = rooms.get(roomId);
  if (!room) return { ok: false, error: "Sala não encontrada." };
  if (!room.hostSecret) return { ok: false, error: "A sala ainda está vazia. O anfitrião deve entrar primeiro." };
  if (room.guestSecret) return { ok: false, error: "Sala já cheia." };
  const guestSecret = randomId(24);
  room.guestSecret = guestSecret;
  room.guestName = guestName.trim() || "Jogador 2";
  room.version++;
  damasBroadcastRoom(roomId, { type: "state", state: toPublic(room, null) });
  return { ok: true, guestSecret };
}

function secretToSeat(room: InternalRoom, secret: string): DamasOwner | null {
  if (!room.hostSecret) return null;
  if (secret === room.hostSecret) return 0;
  if (room.guestSecret && secret === room.guestSecret) return 1;
  return null;
}

export function damasGetState(
  roomId: string,
  secret: string | null,
): { ok: true; state: DamasPublicState } | { ok: false; error: string } {
  if (isDamasVipRoomId(roomId)) return { ok: false, error: "Sala VIP: em breve." };
  const room = rooms.get(roomId);
  if (!room) return { ok: false, error: "Sala não encontrada." };
  const seat = secret ? secretToSeat(room, secret) : null;
  if (secret && seat === null) return { ok: false, error: "Token inválido." };
  return { ok: true, state: toPublic(room, seat) };
}

export function damasTryMove(
  roomId: string,
  secret: string,
  from: Pos,
  to: Pos,
):
  | { ok: true; state: DamasPublicState }
  | { ok: false; error: string; state?: DamasPublicState } {
  if (isDamasVipRoomId(roomId)) return { ok: false, error: "Sala VIP: em breve." };
  const room = rooms.get(roomId);
  if (!room) return { ok: false, error: "Sala não encontrada." };
  if (!room.hostSecret) return { ok: false, error: "Sala vazia." };
  if (room.winner !== null) return { ok: false, error: "Partida terminada.", state: toPublic(room, null) };

  const seat = secretToSeat(room, secret);
  if (seat === null) return { ok: false, error: "Token inválido." };
  if (room.guestSecret === null) return { ok: false, error: "Aguardando segundo jogador." };

  if (room.turn !== seat) return { ok: false, error: "Não é a sua vez." };

  const legal = listLegalMoves(room.board, room.turn, room.mustContinueFrom);
  const move = findMatchingMove(legal, from, to);
  if (!move) return { ok: false, error: "Jogada inválida." };

  const nextBoard = applyMove(room.board, move);
  const cont = move.jumped.length > 0 ? mustContinueCapture(nextBoard, room.turn, move.to) : null;

  room.board = nextBoard;
  room.mustContinueFrom = cont;

  if (cont === null) {
    room.turn = other(room.turn);
    const w0 = countPieces(room.board, 0);
    const w1 = countPieces(room.board, 1);
    if (w0 === 0) room.winner = 1;
    else if (w1 === 0) room.winner = 0;
    else {
      const nextLegal = listLegalMoves(room.board, room.turn, null);
      if (nextLegal.length === 0) room.winner = other(room.turn);
    }
  }

  room.version++;
  damasBroadcastRoom(roomId, { type: "state", state: toPublic(room, null) });
  return { ok: true, state: toPublic(room, seat) };
}
