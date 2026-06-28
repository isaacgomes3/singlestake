import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/back-office/admin/payment-gateway")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { jsonResponse, requireSessionUser } = await import("@/lib/server/auth/http");
        const {
          getPaymentGatewaySettings,
          redactPaymentGatewaySettings,
        } = await import("@/lib/server/finance/payment-gateway-settings");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const settings = await getPaymentGatewaySettings();
        return jsonResponse({ ok: true, settings: redactPaymentGatewaySettings(settings) });
      },
      PUT: async ({ request }) => {
        const { jsonResponse, readJsonBody, requireSessionUser } = await import(
          "@/lib/server/auth/http"
        );
        const {
          getPaymentGatewaySettings,
          redactPaymentGatewaySettings,
          savePaymentGatewaySettings,
        } = await import("@/lib/server/finance/payment-gateway-settings");

        const user = await requireSessionUser(request);
        if (!user) return jsonResponse({ ok: false, error: "Não autenticado." }, { status: 401 });
        if (user.role !== "admin") {
          return jsonResponse({ ok: false, error: "Acesso negado." }, { status: 403 });
        }

        const body = await readJsonBody<{
          apiBaseUrl?: string;
          clientId?: string;
          clientSecret?: string;
          callbackUrl?: string;
          enabled?: boolean;
        }>(request);

        const current = await getPaymentGatewaySettings();
        const clientSecret =
          body?.clientSecret?.trim() && body.clientSecret !== "••••••••"
            ? body.clientSecret.trim()
            : current.clientSecret;

        const saved = await savePaymentGatewaySettings({
          apiBaseUrl: body?.apiBaseUrl?.trim() || current.apiBaseUrl,
          clientId: body?.clientId?.trim() ?? current.clientId,
          clientSecret,
          callbackUrl: body?.callbackUrl?.trim() || current.callbackUrl,
          enabled: true,
        });

        return jsonResponse({ ok: true, settings: redactPaymentGatewaySettings(saved) });
      },
    },
  },
});
