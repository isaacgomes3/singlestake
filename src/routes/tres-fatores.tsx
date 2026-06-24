import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tres-fatores")({
  beforeLoad: () => {
    throw redirect({ to: "/ruas", replace: true });
  },
});
