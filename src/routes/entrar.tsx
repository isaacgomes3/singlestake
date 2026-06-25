import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { LoginPage } from "@/components/auth/login-page";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/entrar")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Entrar — singlestake" }],
  }),
  component: LoginPage,
});
