import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/smart-move")({
  beforeLoad: () => {
    throw redirect({ to: "/ruas", replace: true });
  },
});
