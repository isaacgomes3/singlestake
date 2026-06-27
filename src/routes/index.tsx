import { createFileRoute, redirect } from "@tanstack/react-router";

import { getSession, postAuthRedirectPath } from "@/lib/auth/session";
import {
  AUTOMATION_DEFAULT_ENTRY,
  getAutomationPublicOrigin,
  isAutomationProfile,
} from "@/lib/app-profile";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (isAutomationProfile()) {
      const origin = getAutomationPublicOrigin();
      throw redirect({
        href: origin ? `${origin}${AUTOMATION_DEFAULT_ENTRY}` : AUTOMATION_DEFAULT_ENTRY,
        replace: true,
      });
    }
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
