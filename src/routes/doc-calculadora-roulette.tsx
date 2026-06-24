import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/doc-calculadora-roulette")({
  beforeLoad: () => {
    throw redirect({ to: "/ruas", replace: true });
  },
});
