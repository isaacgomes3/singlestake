import {
  ROULETTE_MACAO_TABLE_ID,
  resolveMacaoTableIdFromLiveTableIds,
} from "@/lib/roulette/lobbyTables";
import {
  DGA_ROULETTE_TABLE_POSTERS,
  dgaRouletteLocalPosterPath,
} from "@/lib/roulette/dgaRouletteTablePosters";
import { getDgaTableImageUrl } from "@/lib/roulette/dgaTableImageStore";
import { getLiveRouletteTableIds } from "@/lib/roulette/liveTableConfig";

/** Caminhos locais (`public/lobby/dga/`) — posters oficiais descarregados da DGA. */
const LOBBY_CARD_ASSETS: Record<number, string> = Object.fromEntries(
  Object.keys(DGA_ROULETTE_TABLE_POSTERS).map((id) => [
    Number(id),
    dgaRouletteLocalPosterPath(Number(id)),
  ]),
);

const ROTATING_ROOM_LOBBY_BG =
  "linear-gradient(135deg, #0a1628 0%, #0d2040 40%, #1a0a28 100%)";

function isMacaoSlot(tableId: number, macaoTableId: number): boolean {
  return tableId === macaoTableId;
}

function resolveMacaoTableId(macaoTableId?: number): number {
  return (
    macaoTableId ??
    (typeof window !== "undefined"
      ? resolveMacaoTableIdFromLiveTableIds(getLiveRouletteTableIds())
      : ROULETTE_MACAO_TABLE_ID)
  );
}

/** URL absoluta de um ficheiro em `public/` (respeita `import.meta.env.BASE_URL`). */
export function lobbyPublicAssetUrl(relativePublicPath: string): string {
  const path = relativePublicPath.replace(/^\//, "");
  const base = import.meta.env.BASE_URL || "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}${path}`;
}

/** Ajuste de recorte (`background-position`) para fotos no aspecto 16/10 dos cartões. */
export function lobbyTableCardObjectPosition(tableId: number, macaoTableId?: number): string {
  const macao = resolveMacaoTableId(macaoTableId);
  if (tableId === macao) return "center 30%";
  if (tableId === 227) return "center 38%";
  if (tableId === 203) return "center 36%";
  if (tableId === 230) return "center 36%";
  if (tableId === 237) return "center 32%";
  if (tableId === 213) return "center 34%";
  if (tableId === 28401) return "center 32%";
  return "center";
}

/** Imagem do cartão do lobby para uma mesa Pragmatic. */
export function lobbyTableCardPhotoUrl(tableId: number, macaoTableId?: number): string | null {
  const dgaUrl = getDgaTableImageUrl(tableId) ?? DGA_ROULETTE_TABLE_POSTERS[tableId];
  if (dgaUrl) return dgaUrl;

  const macao = resolveMacaoTableId(macaoTableId);
  const asset = LOBBY_CARD_ASSETS[tableId];
  if (asset) return lobbyPublicAssetUrl(asset);
  if (isMacaoSlot(tableId, macao)) {
    const macaoAsset = LOBBY_CARD_ASSETS[macao];
    if (macaoAsset) return lobbyPublicAssetUrl(macaoAsset);
  }
  return null;
}

/** Estilo inline para a camada de foto do cartão (evita `<img loading=\"lazy\">` falhar no grid). */
export function lobbyTableCardPhotoStyle(
  tableId: number,
  macaoTableId?: number,
): { backgroundImage: string; backgroundPosition: string } | null {
  const url = lobbyTableCardPhotoUrl(tableId, macaoTableId);
  if (!url) return null;
  return {
    backgroundImage: `url("${url}")`,
    backgroundPosition: lobbyTableCardObjectPosition(tableId, macaoTableId),
  };
}

export function lobbyTableCardFallbackBg(): string {
  return ROTATING_ROOM_LOBBY_BG;
}

/** Poster «aguarde no lobby» da sala rotativa (`public/images/`). */
export const ROTATING_ROOM_LOBBY_WAIT_PHOTO = "images/sala-rotativa-lobby-wait.png";

export function rotatingRoomLobbyWaitPhotoStyle(): {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
} {
  return {
    backgroundImage: `url("${lobbyPublicAssetUrl(ROTATING_ROOM_LOBBY_WAIT_PHOTO)}")`,
    backgroundPosition: "center center",
    backgroundSize: "cover",
  };
}
