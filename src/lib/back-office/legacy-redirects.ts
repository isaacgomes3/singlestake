import { redirect } from "@tanstack/react-router";

import { BACK_OFFICE_PATHS } from "@/lib/back-office/routes";

export function parseMesaSearch(search: Record<string, unknown>): number | undefined {
  const raw = search.mesa;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(String(raw));
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export function parseMesaIdParam(raw: string): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

/** Estruturas antigas do lobby / mobile → back office ou ferramenta operacional. */
export function throwLegacyTableRedirect(search: Record<string, unknown>): never {
  const mesa = parseMesaSearch(search);
  if (mesa != null) {
    throw redirect({ to: "/casino-mesa", search: { mesa }, replace: true });
  }
  throw redirect({ to: BACK_OFFICE_PATHS.casinoAoVivo, replace: true });
}

export function throwLegacyCassinoRedirect(): never {
  throw redirect({ to: BACK_OFFICE_PATHS.casinoAoVivo, replace: true });
}

export function throwLegacyBackOfficeRedirect(): never {
  throw redirect({ to: BACK_OFFICE_PATHS.home, replace: true });
}

export function throwLegacyMobileMesaRedirect(mesaId: string): never {
  const mesa = parseMesaIdParam(mesaId);
  if (mesa != null) {
    throw redirect({ to: "/casino-mesa", search: { mesa }, replace: true });
  }
  throw redirect({ to: BACK_OFFICE_PATHS.casinoAoVivo, replace: true });
}
