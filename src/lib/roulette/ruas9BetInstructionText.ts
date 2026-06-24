import {
  CASINO_STREETS,
  streetBetTargetsFromActive,
  type StreetStrategyActive,
} from "@/lib/roulette/streetStrategy";

/** Resumo mínimo para colar no casino (sem texto de regra). */
export function formatRuas9BetInstructionText(active: StreetStrategyActive | null): string {
  if (!active) return "";

  const { streetIds, outsideZone } = streetBetTargetsFromActive(active);
  const streetLines = streetIds.map((id) => {
    const def = CASINO_STREETS.find((s) => s.id === id);
    const nums = def ? def.numbers.join(", ") : "?";
    return `Rua ${id}: ${nums}`;
  });

  const halfLabel = outsideZone === "1-18" ? "1–18" : "19–36";
  const excl = [...active.excludedStreetIds].join(", ");

  return [
    `Transversais: ${streetLines.join(" · ")}`,
    `Metade: ${halfLabel}`,
    `Excluir ruas: ${excl}`,
  ].join("\n");
}
