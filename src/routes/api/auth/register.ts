import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readJsonBody, jsonResponse, toAuthUser } = await import("@/lib/server/auth/http");
        const { buildSessionCookie } = await import("@/lib/server/auth/cookies");
        const { createHttpSession } = await import("@/lib/server/auth/http-session");
        const { registerAccount } = await import("@/lib/server/auth/service");

        const body = await readJsonBody<{
          name?: string;
          email?: string;
          password?: string;
          referralCode?: string;
        }>(request);

        const result = await registerAccount({
          name: body?.name ?? "",
          email: body?.email ?? "",
          password: body?.password ?? "",
          sponsorReferralCode: body?.referralCode,
        });

        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, { status: 400 });
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
          { status: 201, headers: { "Set-Cookie": buildSessionCookie(sessionId) } },
        );
      },
    },
  },
});
