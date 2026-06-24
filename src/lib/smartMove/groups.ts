/** Grupo rosa (Smart Move). */
export const SMART_MOVE_PINK = new Set<number>([
  32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
]);

/** Grupo azul (Smart Move). */
export const SMART_MOVE_BLUE = new Set<number>([
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]);

export type SmartMoveGroup = "pink" | "blue";

export function smartMoveGroupForNumber(n: number): SmartMoveGroup | null {
  if (n === 0) return null;
  if (SMART_MOVE_PINK.has(n)) return "pink";
  if (SMART_MOVE_BLUE.has(n)) return "blue";
  return null;
}
