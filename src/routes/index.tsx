import { createFileRoute, redirect } from "@tanstack/react-router";

import { isAuthenticated } from "@/lib/auth/session";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && isAuthenticated()) {
      throw redirect({ to: "/back-office" });
    }
    throw redirect({ to: "/entrar" });
  },
  component: () => null,
});
