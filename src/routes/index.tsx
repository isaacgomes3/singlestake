import { createFileRoute, redirect } from "@tanstack/react-router";

import { getSession, postAuthRedirectPath } from "@/lib/auth/session";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const session = getSession();
      if (session) {
        throw redirect({ to: postAuthRedirectPath(session.user) });
      }
    }
    throw redirect({ to: "/entrar" });
  },
  component: () => null,
});
