import { createFileRoute } from "@tanstack/react-router";

import { MobileAppShell } from "@/components/mobile-app/mobile-app-shell";

export const Route = createFileRoute("/mobile")({
  component: MobileLayout,
});

function MobileLayout() {
  return <MobileAppShell />;
}
