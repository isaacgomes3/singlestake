import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FinanceStatusBadge, formatFinanceDate } from "@/components/back-office/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/auth/session";
import { createDeposit, fetchDeposits, processDeposit } from "@/lib/back-office/finance-api";
import type { DepositRecord } from "@/lib/back-office/finance-types";
import { formatBrl } from "@/lib/back-office/mock-data";

export function BackOfficeDepositsPanel() {
  const isAdmin = getSession()?.user.role === "admin";
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"pix" | "crypto">("pix");
  const [externalRef, setExternalRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const rows = await fetchDeposits();
    setDeposits(rows);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await createDeposit({
      amount: Number(amount.replace(",", ".")),
      method,
      externalRef: externalRef.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pedido de depósito enviado. Aguarde aprovação.");
    setAmount("");
    setExternalRef("");
    void reload();
  };

  const handleProcess = async (id: string, action: "approve" | "reject") => {
    setProcessingId(id);
    const result = await processDeposit(id, action);
    setProcessingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(action === "approve" ? "Depósito aprovado e creditado." : "Depósito rejeitado.");
    void reload();
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Solicitar depósito</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Valor mínimo R$ 50,00. Após o pagamento, aguarde a confirmação do administrador.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="deposit-amount" className="text-xs font-medium text-text-secondary">
              Valor (R$)
            </label>
            <Input
              id="deposit-amount"
              type="number"
              min={50}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="deposit-method" className="text-xs font-medium text-text-secondary">
              Método
            </label>
            <select
              id="deposit-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as "pix" | "crypto")}
              className="flex h-9 w-full rounded-md border border-border-color bg-bg-secondary px-3 text-sm text-text-primary"
            >
              <option value="pix">PIX</option>
              <option value="crypto">Criptomoeda</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="deposit-ref" className="text-xs font-medium text-text-secondary">
              Comprovante / referência (opcional)
            </label>
            <Input
              id="deposit-ref"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="ID da transação, hash, etc."
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "A enviar…" : "Solicitar depósito"}
            </Button>
          </div>
        </form>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {isAdmin ? "Todos os pedidos" : "Os meus depósitos"}
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-text-secondary">A carregar…</p>
        ) : deposits.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">Nenhum depósito registado.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5">Data</th>
                  {isAdmin ? <th className="px-3 py-2.5">Utilizador</th> : null}
                  <th className="px-3 py-2.5">Valor</th>
                  <th className="px-3 py-2.5">Método</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Referência</th>
                  {isAdmin ? <th className="px-3 py-2.5">Acções</th> : null}
                </tr>
              </thead>
              <tbody>
                {deposits.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-secondary">{formatFinanceDate(row.createdAt)}</td>
                    {isAdmin ? (
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-text-primary">{row.userName}</p>
                        <p className="text-xs text-text-secondary">{row.userEmail}</p>
                      </td>
                    ) : null}
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-text-primary">
                      {formatBrl(row.amount)}
                    </td>
                    <td className="px-3 py-2.5 uppercase text-text-secondary">{row.method}</td>
                    <td className="px-3 py-2.5">
                      <FinanceStatusBadge status={row.status} />
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2.5 text-text-secondary">
                      {row.externalRef ?? "—"}
                    </td>
                    {isAdmin ? (
                      <td className="px-3 py-2.5">
                        {row.status === "pending" ? (
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="success"
                              disabled={processingId === row.id}
                              onClick={() => void handleProcess(row.id, "approve")}
                            >
                              Aprovar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={processingId === row.id}
                              onClick={() => void handleProcess(row.id, "reject")}
                            >
                              Rejeitar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-text-secondary">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
