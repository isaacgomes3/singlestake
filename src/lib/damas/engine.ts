import type { DamasBoard, DamasMove, DamasOwner, DamasPiece, Pos } from "./types";

export function createInitialBoard(): DamasBoard {
  const b: DamasBoard = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue;
      if (r < 3) b[r]![c] = { owner: 0, king: false };
      else if (r > 4) b[r]![c] = { owner: 1, king: false };
    }
  }
  return b;
}

function playable(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8 && (r + c) % 2 === 1;
}

function at(board: DamasBoard, p: Pos): DamasPiece | null {
  if (!playable(p.r, p.c)) return null;
  return board[p.r]![p.c]!;
}

function forwardDr(owner: DamasOwner): number {
  return owner === 0 ? 1 : -1;
}

/** Todas as capturas simples (um salto) a partir de uma casa; `pieceOwner` quem salta. */
function captureStepsFrom(
  board: DamasBoard,
  from: Pos,
  piece: DamasPiece,
): DamasMove[] {
  const out: DamasMove[] = [];
  const dirs: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [dr, dc] of dirs) {
    const mid = { r: from.r + dr, c: from.c + dc };
    const land = { r: from.r + 2 * dr, c: from.c + 2 * dc };
    if (!playable(mid.r, mid.c) || !playable(land.r, land.c)) continue;
    const midP = board[mid.r]![mid.c];
    const landP = board[land.r]![land.c];
    if (midP === null || midP.owner === piece.owner) continue;
    if (landP !== null) continue;
    if (!piece.king) {
      /* Pedra: só captura para “frente” no tabuleiro (em direção ao adversário). */
      const fdr = forwardDr(piece.owner);
      if (dr !== fdr) continue;
    }
    out.push({ from, to: land, jumped: [mid] });
  }
  return out;
}

function allCaptureMoves(
  board: DamasBoard,
  turn: DamasOwner,
  mustFrom: Pos | null,
): DamasMove[] {
  const moves: DamasMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue;
      const p = board[r]![c];
      if (p === null || p.owner !== turn) continue;
      const from = { r, c };
      if (mustFrom && (mustFrom.r !== r || mustFrom.c !== c)) continue;
      moves.push(...captureStepsFrom(board, from, p));
    }
  }
  return moves;
}

function simpleMoves(board: DamasBoard, turn: DamasOwner): DamasMove[] {
  const moves: DamasMove[] = [];
  const fdr = forwardDr(turn);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue;
      const p = board[r]![c];
      if (p === null || p.owner !== turn) continue;
      const dirs: [number, number][] = p.king
        ? [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ]
        : [
            [fdr, -1],
            [fdr, 1],
          ];
      for (const [dr, dc] of dirs) {
        const to = { r: r + dr, c: c + dc };
        if (!playable(to.r, to.c)) continue;
        if (board[to.r]![to.c] !== null) continue;
        moves.push({ from: { r, c }, to, jumped: [] });
      }
    }
  }
  return moves;
}

export function listLegalMoves(
  board: DamasBoard,
  turn: DamasOwner,
  mustContinueFrom: Pos | null,
): DamasMove[] {
  const caps = allCaptureMoves(board, turn, mustContinueFrom);
  if (caps.length > 0) return caps;
  if (mustContinueFrom) return [];
  return simpleMoves(board, turn);
}

function cloneBoard(board: DamasBoard): DamasBoard {
  return board.map((row) => row.map((cell) => (cell === null ? null : { ...cell })));
}

function maybePromote(board: DamasBoard, pos: Pos, piece: DamasPiece): void {
  if (piece.king) return;
  if (piece.owner === 0 && pos.r === 7) piece.king = true;
  if (piece.owner === 1 && pos.r === 0) piece.king = true;
}

export function applyMove(board: DamasBoard, move: DamasMove): DamasBoard {
  const next = cloneBoard(board);
  const piece = at(next, move.from);
  if (piece === null) return next;
  next[move.from.r]![move.from.c] = null;
  for (const j of move.jumped) {
    next[j.r]![j.c] = null;
  }
  const moved: DamasPiece = { ...piece };
  next[move.to.r]![move.to.c] = moved;
  maybePromote(next, move.to, moved);
  return next;
}

/** Após um movimento, verifica se a mesma peça deve continuar a capturar. */
export function mustContinueCapture(board: DamasBoard, turn: DamasOwner, landed: Pos): Pos | null {
  const p = at(board, landed);
  if (p === null || p.owner !== turn) return null;
  const more = captureStepsFrom(board, landed, p);
  return more.length > 0 ? landed : null;
}

export function findMatchingMove(
  legal: DamasMove[],
  from: Pos,
  to: Pos,
): DamasMove | null {
  return (
    legal.find((m) => m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c) ??
    null
  );
}

export function countPieces(board: DamasBoard, owner: DamasOwner): number {
  let n = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 0) continue;
      const p = board[r]![c];
      if (p && p.owner === owner) n++;
    }
  }
  return n;
}

export function other(owner: DamasOwner): DamasOwner {
  return owner === 0 ? 1 : 0;
}
