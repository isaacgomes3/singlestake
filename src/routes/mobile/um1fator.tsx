import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/um1fator")({
  beforeLoad: () => {
    throw redirect({ to: "/mobile" });
  },
  component: () => null,
});
