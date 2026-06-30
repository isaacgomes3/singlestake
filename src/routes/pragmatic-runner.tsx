import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pragmatic-runner")({
  beforeLoad: () => {
    throw redirect({ to: "/sala-rotativa-dois-fatores", replace: true });
  },
  component: () => null,
});
