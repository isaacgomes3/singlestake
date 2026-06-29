import { redirect } from "@tanstack/react-router";

import { isAuthenticated } from "./session";

function canReadSession(): boolean {
  return typeof window !== "undefined";
}

/** Bloqueia área quando mensalidade está vencida (operações, sala rotativa, automação global). */
export async function requireActiveSubscription(
  redirectTo = "/back-office/produtos/mensalidades",
): Promise<void> {
  if (!canReadSession()) return;
  if (!isAuthenticated()) {
    throw redirect({ to: "/entrar" });
  }

  const res = await fetch("/api/back-office/subscription", { credentials: "include" });
  if (!res.ok) return;

  const data = (await res.json()) as { subscription?: { active?: boolean } };
  if (data.subscription?.active) return;

  throw redirect({ to: redirectTo });
}
