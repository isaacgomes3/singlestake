import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fetchSubscription, paySubscription } from "@/lib/back-office/product-api";
import type { SubscriptionDto } from "@/lib/back-office/product-types";
import { SUBSCRIPTION_GRACE_DAYS } from "@/lib/back-office/product-constants";
import { formatBrl } from "@/lib/back-office/mock-data";

const STATUS_LABELS: Record<SubscriptionDto["status"], string> = {
  grace: "Período gratuito",
  active: "Em dia",
  pending: "Pendente",
  expired: "Vencida",
};

export function BackOfficeSubscriptionsPanel() {
  const [sub, setSub] = useState<SubscriptionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const reload = async () => {
    setLoading(true);
    setSub(await fetchSubscription());
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handlePay = async () => {
    setPaying(true);
    const result = await paySubscription();
    setPaying(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Mensalidade paga. Acesso restaurado.");
    void reload();
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Mensalidade</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Primeiros {SUBSCRIPTION_GRACE_DAYS} dias gratuitos. Depois, mantenha em dia para aceder a
          bónus, automação e serviços de afiliado.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Status",
              value: loading ? "…" : STATUS_LABELS[sub?.status ?? "pending"],
            },
            {
              label: "Valor",
              value: loading ? "…" : formatBrl(sub?.amount ?? 0),
            },
            {
              label: "Acesso activo",
              value: loading ? "…" : sub?.active ? "Sim" : "Não",
            },
            {
              label: "Dias até vencimento",
              value:
                loading || sub?.daysUntilDue == null ? "—" : String(sub.daysUntilDue),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{item.label}</p>
              <p className="mt-1 font-bold text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>

        {!loading && sub && !sub.active ? (
          <Button type="button" className="mt-4" disabled={paying} onClick={() => void handlePay()}>
            {paying ? "A processar…" : `Pagar mensalidade (${formatBrl(sub.amount)})`}
          </Button>
        ) : null}

        {!loading && sub?.active && sub.status === "expired" ? null : null}

        {!loading && sub?.status === "active" && sub.renewsAt ? (
          <p className="mt-3 text-xs text-text-secondary">
            Próxima renovação: {new Date(sub.renewsAt).toLocaleDateString("pt-BR")}
          </p>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Regra de repasse</h2>
        <p className="mt-2 text-sm text-text-secondary">
          50% distribuído na rede (5 níveis) · 50% carteira empresa.
        </p>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Ganhos perdidos (mensalidade vencida)</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Valores não creditados enquanto a mensalidade estiver vencida. Não acumulam após
          regularização.
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-text-secondary">A carregar…</p>
        ) : (sub?.missedCredits.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">Nenhum crédito perdido registado.</p>
        ) : (
          <>
            <p className="mt-3 text-sm font-semibold text-amber-400">
              Total perdido: {formatBrl(sub?.missedTotal ?? 0)}
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                    <th className="px-3 py-2.5">Data</th>
                    <th className="px-3 py-2.5">Motivo</th>
                    <th className="px-3 py-2.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {sub!.missedCredits.map((row, i) => (
                    <tr key={i} className="border-b border-border-color/60 last:border-0">
                      <td className="px-3 py-2.5 text-text-secondary">
                        {new Date(row.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-2.5 text-text-primary">{row.reason}</td>
                      <td className="px-3 py-2.5 tabular-nums text-amber-400">
                        {formatBrl(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
