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

/** Estruturas antigas do lobby / mobile → back office ou sala rotativa. */
export function throwLegacyTableRedirect(search: Record<string, unknown>): never {
  throw redirect({ to: BACK_OFFICE_PATHS.salaRotativa, replace: true });
}

export function throwLegacyCassinoRedirect(): never {
  throw redirect({ to: BACK_OFFICE_PATHS.home, replace: true });
}

export function throwLegacyBackOfficeRedirect(): never {
  throw redirect({ to: BACK_OFFICE_PATHS.home, replace: true });
}

export function throwLegacyMobileMesaRedirect(_mesaId: string): never {
  throw redirect({ to: BACK_OFFICE_PATHS.salaRotativa, replace: true });
}
