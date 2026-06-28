import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchPaymentGatewaySettings,
  savePaymentGatewaySettings,
  type PaymentGatewaySettingsDto,
} from "@/lib/back-office/payment-gateway-api";

export function BackOfficePaymentGatewayPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PaymentGatewaySettingsDto>({
    apiBaseUrl: "https://api.lucpaguei.com",
    clientId: "stake37_MLRCIKYE",
    clientSecret: "",
    callbackUrl: "https://stake37.com.br/api/webhooks/luc-paguei",
    enabled: true,
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const settings = await fetchPaymentGatewaySettings();
      if (settings) {
        setForm({
          ...settings,
          enabled: true,
          clientSecret: settings.hasClientSecret ? "" : settings.clientSecret,
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await savePaymentGatewaySettings({ ...form, enabled: true });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setForm({
      ...result.settings,
      enabled: true,
      clientSecret: result.settings.hasClientSecret ? "" : result.settings.clientSecret,
    });
    toast.success("Gateway PIX guardado.");
  };

  if (loading) {
    return <p className="text-sm text-text-secondary">A carregar gateway…</p>;
  }

  return (
    <section className="theme-card rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-text-primary">Gateway PIX — Luc Paguei</h2>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          Activo
        </span>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        Mesma plataforma da Poupex. Depósitos e saques automáticos via webhook.
      </p>

      <form onSubmit={handleSave} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-text-secondary" htmlFor="gw-base">
            API base URL
          </label>
          <Input
            id="gw-base"
            value={form.apiBaseUrl}
            onChange={(e) => setForm((f) => ({ ...f, apiBaseUrl: e.target.value }))}
            placeholder="https://api.lucpaguei.com"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor="gw-client-id">
            Client ID
          </label>
          <Input
            id="gw-client-id"
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor="gw-client-secret">
            Client Secret
          </label>
          <Input
            id="gw-client-secret"
            type="password"
            value={form.clientSecret}
            onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
            placeholder={form.hasClientSecret ? "Secret guardado — cole só para alterar" : "Cole o Client Secret completo"}
            autoComplete="new-password"
          />
          {form.hasClientSecret && !form.clientSecret ? (
            <p className="text-[11px] text-emerald-400">
              Secret configurado no servidor. Deixe vazio para manter o actual ao guardar.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-text-secondary" htmlFor="gw-callback">
            Callback URL (webhook)
          </label>
          <Input
            id="gw-callback"
            value={form.callbackUrl}
            onChange={(e) => setForm((f) => ({ ...f, callbackUrl: e.target.value }))}
            placeholder="https://stake37.com.br/api/webhooks/luc-paguei"
          />
          <p className="text-[11px] text-text-secondary">
            Registe esta URL no painel Luc Paguei. Deve ser HTTPS e acessível publicamente.
          </p>
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "A guardar…" : "Guardar gateway"}
          </Button>
        </div>
      </form>
    </section>
  );
}
