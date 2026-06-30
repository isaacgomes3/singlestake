import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchPaymentGatewaySettings,
  savePaymentGatewaySettings,
  type PaymentGatewaySettingsDto,
} from "@/lib/back-office/payment-gateway-api";

const DEFAULT_FORM: PaymentGatewaySettingsDto = {
  apiBaseUrl: "https://api.lucpaguei.com",
  clientId: "stake37_MLRCIKYE",
  clientSecret: "",
  callbackUrl: "https://stake37.com.br/api/webhooks/luc-paguei",
  enabled: true,
  withdrawalMode: "manual",
  withdrawalAutoLimit: 500,
  pixManualConfirmation: true,
};

export function BackOfficePaymentGatewayPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PaymentGatewaySettingsDto>(DEFAULT_FORM);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const settings = await fetchPaymentGatewaySettings();
      if (settings) {
        setForm({
          ...DEFAULT_FORM,
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
      ...DEFAULT_FORM,
      ...result.settings,
      enabled: true,
      clientSecret: result.settings.hasClientSecret ? "" : result.settings.clientSecret,
    });
    toast.success("Configurações de pagamento guardadas.");
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
        Credenciais do gateway e regras de confirmação manual vs automática.
      </p>

      <form onSubmit={handleSave} className="mt-4 space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
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
              placeholder={
                form.hasClientSecret ? "Secret guardado — cole só para alterar" : "Cole o Client Secret completo"
              }
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
        </div>

        <div className="rounded-xl border border-border-color bg-bg-secondary/60 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
            Confirmação de pagamentos PIX
          </h3>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.pixManualConfirmation}
              onChange={(e) => setForm((f) => ({ ...f, pixManualConfirmation: e.target.checked }))}
            />
            <span className="text-sm text-text-primary">
              Confirmação manual (admin aprova depósitos, Start e automação)
              <span className="mt-0.5 block text-xs text-text-secondary">
                Com esta opção activa, o webhook regista o pagamento mas não credita saldo nem activa pacotes
                automaticamente.
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-border-color bg-bg-secondary/60 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Modo de saque</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary" htmlFor="gw-withdraw-mode">
                Modo de saque
              </label>
              <select
                id="gw-withdraw-mode"
                value={form.withdrawalMode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    withdrawalMode: e.target.value as PaymentGatewaySettingsDto["withdrawalMode"],
                  }))
                }
                className="flex h-9 w-full rounded-md border border-border-color bg-bg-primary px-3 text-sm text-text-primary"
              >
                <option value="manual">Saques manuais</option>
                <option value="automatic_up_to_limit">Automático até limite</option>
              </select>
              <p className="text-[11px] text-text-secondary">
                Manual: admin aprova e envia PIX fora do sistema. Automático: gateway envia PIX até ao limite
                (requer CPF válido do utilizador).
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary" htmlFor="gw-withdraw-limit">
                Limite saque automático (R$)
              </label>
              <Input
                id="gw-withdraw-limit"
                type="number"
                min={50}
                step={50}
                disabled={form.withdrawalMode !== "automatic_up_to_limit"}
                value={form.withdrawalAutoLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, withdrawalAutoLimit: Number(e.target.value) || 500 }))
                }
              />
              <p className="text-[11px] text-text-secondary">
                Valores acima do limite ou sem CPF válido são aprovados para pagamento manual.
              </p>
            </div>
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "A guardar…" : "Guardar configurações"}
        </Button>
      </form>
    </section>
  );
}
