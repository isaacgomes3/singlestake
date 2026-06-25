import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pragmatic-runner")({
  beforeLoad: () => {
    throw redirect({ to: "/sala-rotativa-um-fator", replace: true });
  },
  component: () => null,
});
