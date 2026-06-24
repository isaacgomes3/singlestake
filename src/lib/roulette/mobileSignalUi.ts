import { ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS } from "@/lib/roulette/rotatingRoomCrossingSession";
import { colorOf } from "@/lib/roulette/streetStrategy";

export type MobileSignalConfidence = "Alta" | "Média" | "Baixa";

export function mobileSignalConfidenceFromBucketGap(gap: number): MobileSignalConfidence {
  if (gap >= ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS + 4) return "Alta";
  if (gap >= ROTATING_ROOM_CROSSING_MIN_ABSENCE_SPINS) return "Média";
  return "Baixa";
}

export function formatMobileLastNumbersChain(numbers: readonly number[], count = 4): string {
  const slice = numbers.slice(0, count);
  if (slice.length === 0) return "—";
  return slice.join(" → ");
}

export function mobileSpinStripClass(n: number): string {
  const c = colorOf(n);
  if (c === "Zero") return "bg-emerald-600 text-white";
  if (c === "Vermelho") return "bg-red-600 text-white";
  return "bg-neutral-800 text-neutral-100";
}

export function mobileLifetimeAssertivenessPct(wins: number, losses: number): number | null {
  const total = wins + losses;
  if (total === 0) return null;
  return (wins / total) * 100;
}
