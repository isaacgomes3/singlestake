import { createFileRoute } from "@tanstack/react-router";

import { RegisterPage } from "@/components/auth/register-page";

export const Route = createFileRoute("/registar")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } => {
    const raw = search.ref;
    if (typeof raw !== "string" || !raw.trim()) return {};
    return { ref: raw.trim().toUpperCase() };
  },
  head: () => ({
    meta: [{ title: "Criar conta — singlestake" }],
  }),
  component: RegisterRoute,
});

function RegisterRoute() {
  const { ref } = Route.useSearch();
  return <RegisterPage initialReferralCode={ref} />;
}
