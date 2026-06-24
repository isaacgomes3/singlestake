import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/dois2fatores")({
  beforeLoad: () => {
    throw redirect({ to: "/mobile" });
  },
  component: () => null,
});
