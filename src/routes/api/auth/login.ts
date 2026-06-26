import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readJsonBody, jsonResponse, toAuthUser } = await import("@/lib/server/auth/http");
        const { buildSessionCookie, isSecureRequest } = await import("@/lib/server/auth/cookies");
        const { createHttpSession } = await import("@/lib/server/auth/http-session");
        const { loginWithPassword } = await import("@/lib/server/auth/service");

        const body = await readJsonBody<{ email?: string; password?: string }>(request);
        const email = body?.email ?? "";
        const password = body?.password ?? "";

        const result = await loginWithPassword(email, password);
        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 401 });
        }

        const { sessionId } = await createHttpSession(result.user.id);
        const origin = new URL(request.url).origin;
        return jsonResponse(
          {
            ok: true,
            user: toAuthUser(
              {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role,
                referralCode: result.user.referralCode,
              },
              origin,
            ),
          },
          { headers: { "Set-Cookie": buildSessionCookie(sessionId, undefined, isSecureRequest(request)) } },
        );
      },
    },
  },
});
