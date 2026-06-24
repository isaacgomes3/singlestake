/** Salas fixas no lobby de damas (IDs estáveis na URL e no servidor). */
export const DAMAS_LOBBY_SALA_1 = "sala-1";
export const DAMAS_LOBBY_SALA_2 = "sala-2";
export const DAMAS_LOBBY_SALA_VIP = "sala-vip";

export const DAMAS_FIXED_LOBBY_ROOM_IDS = [DAMAS_LOBBY_SALA_1, DAMAS_LOBBY_SALA_2] as const;

export function isDamasFixedLobbyRoomId(id: string): id is (typeof DAMAS_FIXED_LOBBY_ROOM_IDS)[number] {
  return (DAMAS_FIXED_LOBBY_ROOM_IDS as readonly string[]).includes(id);
}

export function isDamasVipRoomId(id: string): boolean {
  return id === DAMAS_LOBBY_SALA_VIP;
}
