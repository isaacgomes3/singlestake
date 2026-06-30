import { redirect } from "@tanstack/react-router";

import { apiFetchMe } from "@/lib/auth/api";
import { isAdminUser } from "@/lib/back-office/admin-access";
import { getSession, isAuthenticated } from "@/lib/auth/session";

/** Bloqueia rotas e módulos reservados a administradores. */
export async function requireAdminRole(redirectTo = "/back-office"): Promise<void> {
  if (typeof window === "undefined") return;

  if (!isAuthenticated()) {
    throw redirect({ to: "/entrar" });
  }

  if (isAdminUser(getSession()?.user)) return;

  const user = await apiFetchMe();
  if (isAdminUser(user)) return;

  throw redirect({ to: redirectTo });
}
