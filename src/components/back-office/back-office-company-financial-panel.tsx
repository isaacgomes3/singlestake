import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createCompanyManualWithdrawal,
  fetchCompanyFinancialPanel,
} from "@/lib/back-office/company-financial-api";
import type {
  CompanyFinancialPanel,
  CompanyWalletBucket,
} from "@/lib/back-office/company-financial-types";
import { useFormat } from "@/lib/i18n/use-format";
import { cn } from "@/lib/utils";

const BUCKET_META: Record<
  CompanyWalletBucket,
  { label: string; splitLabel: string; tone: string; manualWithdraw: boolean }
> = {
  empresa: {
    label: "Carteira Empresa",
    splitLabel: "50% automação · 50% adesão/mensalidade",
    tone: "border-emerald-500/35 bg-emerald-950/20",
    manualWithdraw: true,
  },
  afiliados: {
    label: "Carteira Afiliados",
    splitLabel: "30% automação · 50% adesão/mensalidade (pool rede)",
    tone: "border-cyan-500/35 bg-cyan-950/20",
    manualWithdraw: false,
  },
  automacao: {
    label: "Carteira Automação",
    splitLabel: "20% dos depósitos de automação",
    tone: "border-violet-500/35 bg-violet-950/20",
    manualWithdraw: true,
  },
};

function WithdrawForm({
  bucket,
  balance,
  onSuccess,
}: {
  bucket: "empresa" | "automacao";
  balance: number;
  onSuccess: (panel: CompanyFinancialPanel) => void;
}) {
  const { money } = useFormat();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await createCompanyManualWithdrawal({
      bucket,
      amount: Number(amount.replace(",", ".")),
      description: description.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Retirada registada.");
    setAmount("");
    setDescription("");
    onSuccess(result.panel);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border border-border-color bg-bg-secondary p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Retirada manual — saldo {money(balance)}
      </p>
      <Input
        type="text"
        inputMode="decimal"
        placeholder="Valor (R$)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <Textarea
        placeholder="Descrição obrigatória (motivo da retirada)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        required
        minLength={3}
      />
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "A processar…" : "Confirmar retirada"}
      </Button>
    </form>
  );
}

export function BackOfficeCompanyFinancialPanel() {
  const { money, dateTime } = useFormat();
  const [panel, setPanel] = useState<CompanyFinancialPanel | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await fetchCompanyFinancialPanel();
    setPanel(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const total =
    panel == null
      ? 0
      : panel.balances.empresa + panel.balances.afiliados + panel.balances.automacao;

  return (
    <div className="space-y-6">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Distribuição dos recebimentos</h2>
        <ul className="mt-3 space-y-2 text-sm text-text-secondary">
          <li>
            <strong className="text-text-primary">Automação:</strong>{" "}
            {panel
              ? `${Math.round(panel.splits.automation.empresa * 100)}% empresa · ${Math.round(panel.splits.automation.afiliados * 100)}% afiliados · ${Math.round(panel.splits.automation.automacao * 100)}% automação`
              : "50% · 30% · 20%"}
          </li>
          <li>
            <strong className="text-text-primary">Adesão Start e mensalidade:</strong>{" "}
            R$ {panel?.splits.startSubscription.empresa ?? 25} empresa + R${" "}
            {panel?.splits.startSubscription.afiliados ?? 25} pool afiliados (por evento de R$ 50 /
            mensalidade)
          </li>
          <li>
            Saques de afiliados debitam automaticamente a <strong>carteira Afiliados</strong> (sem
            retirada manual).
          </li>
          <li>
            Contas <strong>admin</strong> não recebem comissões de adesão em carteiras pessoais — os
            valores ficam nas carteiras da empresa.
          </li>
        </ul>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Carteiras da empresa</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Total consolidado: {loading ? "…" : money(total)}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            Actualizar
          </Button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {(["empresa", "afiliados", "automacao"] as const).map((bucket) => {
            const meta = BUCKET_META[bucket];
            const balance = panel?.balances[bucket] ?? 0;
            return (
              <div key={bucket} className={cn("rounded-2xl border p-4", meta.tone)}>
                <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                  {meta.label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-text-primary">
                  {loading ? "…" : money(balance)}
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">{meta.splitLabel}</p>
                {!meta.manualWithdraw ? (
                  <p className="mt-3 rounded-lg border border-cyan-500/25 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-100/90">
                    Sem retirada manual. Saques de afiliados deduzem desta carteira ao aprovar o
                    pedido PIX.
                  </p>
                ) : (
                  <WithdrawForm
                    bucket={bucket}
                    balance={balance}
                    onSuccess={setPanel}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Retiradas manuais (empresa / automação)</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                <th className="px-3 py-2.5">Data</th>
                <th className="px-3 py-2.5">Carteira</th>
                <th className="px-3 py-2.5">Valor</th>
                <th className="px-3 py-2.5">Descrição</th>
                <th className="px-3 py-2.5">Administrador</th>
              </tr>
            </thead>
            <tbody>
              {(panel?.manualWithdrawals ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-secondary">
                    {loading ? "A carregar…" : "Nenhuma retirada manual registada."}
                  </td>
                </tr>
              ) : (
                panel!.manualWithdrawals.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 tabular-nums text-text-secondary">
                      {dateTime(row.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-text-primary">{row.bucket}</td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-rose-300">
                      −{money(row.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.description}</td>
                    <td className="px-3 py-2.5 text-text-primary">{row.actorLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Movimentações das carteiras</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                <th className="px-3 py-2.5">Data</th>
                <th className="px-3 py-2.5">Carteira</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Valor</th>
                <th className="px-3 py-2.5">Descrição</th>
                <th className="px-3 py-2.5">Admin</th>
              </tr>
            </thead>
            <tbody>
              {(panel?.movements ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-secondary">
                    {loading ? "A carregar…" : "Sem movimentações."}
                  </td>
                </tr>
              ) : (
                panel!.movements.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 tabular-nums text-text-secondary">
                      {dateTime(row.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-text-primary">{row.bucket}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          row.entryType === "credit"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-rose-500/15 text-rose-300",
                        )}
                      >
                        {row.entryType === "credit" ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 font-semibold tabular-nums",
                        row.entryType === "credit" ? "text-emerald-300" : "text-rose-300",
                      )}
                    >
                      {row.entryType === "credit" ? "+" : "−"}
                      {money(row.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.description}</td>
                    <td className="px-3 py-2.5 text-text-primary">{row.actorLabel ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
