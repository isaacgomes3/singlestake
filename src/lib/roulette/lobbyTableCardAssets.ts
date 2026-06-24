import {
  ROULETTE_MACAO_TABLE_ID,
  resolveMacaoTableIdFromLiveTableIds,
} from "@/lib/roulette/lobbyTables";
import { getLiveRouletteTableIds } from "@/lib/roulette/liveTableConfig";

/** Caminhos relativos à pasta `public/lobby/` (copiados para `dist/client/lobby/` no build). */
const LOBBY_CARD_ASSETS = {
  227: "lobby/roulette-1-azure.png",
  234: "lobby/roulette-latina-card.png",
  230: "lobby/roulette-3-card.png",
  203: "lobby/speed-roulette-1-card.png",
  205: "lobby/speed-roulette-2-card.png",
  201: "lobby/roulette-extra-time-card.png",
  237: "lobby/roulette-brasileira-card.png",
  macao: "lobby/roulette-macao-card.png",
} as const;

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
  if (tableId === 230) return "center 36%";
  if (tableId === 237) return "center 32%";
  return "center";
}

/** Imagem do cartão do lobby para uma mesa Pragmatic. */
export function lobbyTableCardPhotoUrl(tableId: number, macaoTableId?: number): string | null {
  const macao = resolveMacaoTableId(macaoTableId);
  const asset = LOBBY_CARD_ASSETS[tableId as keyof typeof LOBBY_CARD_ASSETS];
  if (asset) return lobbyPublicAssetUrl(asset);
  if (isMacaoSlot(tableId, macao)) return lobbyPublicAssetUrl(LOBBY_CARD_ASSETS.macao);
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
