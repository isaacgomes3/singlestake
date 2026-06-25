import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FinanceStatusBadge, formatFinanceDate } from "@/components/back-office/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/auth/session";
import {
  createWithdrawal,
  fetchWallets,
  fetchWithdrawals,
  processWithdrawal,
} from "@/lib/back-office/finance-api";
import type { WalletRecord, WithdrawalRecord } from "@/lib/back-office/finance-types";
import { formatBrl } from "@/lib/back-office/mock-data";
import { WALLET_BUCKET_LABELS, WITHDRAWABLE_BUCKETS } from "@/lib/back-office/finance-constants";
import type { WalletBucket } from "@/lib/back-office/finance-constants";

export function BackOfficeWithdrawalsPanel() {
  const isAdmin = getSession()?.user.role === "admin";
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [bucket, setBucket] = useState<WalletBucket>("rendimentos");
  const [pixKey, setPixKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const [rows, walletRows] = await Promise.all([fetchWithdrawals(), fetchWallets()]);
    setWithdrawals(rows);
    setWallets(walletRows);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const selectedWallet = wallets.find((w) => w.bucket === bucket);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await createWithdrawal({
      amount: Number(amount.replace(",", ".")),
      bucket,
      pixKey: pixKey.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pedido de saque enviado. Aguarde aprovação.");
    setAmount("");
    setPixKey("");
    void reload();
  };

  const handleProcess = async (id: string, action: "approve" | "reject" | "paid") => {
    setProcessingId(id);
    const result = await processWithdrawal(id, action);
    setProcessingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const labels = {
      approve: "Saque aprovado e debitado da carteira.",
      reject: "Saque rejeitado.",
      paid: "Saque marcado como pago (PIX enviado).",
    };
    toast.success(labels[action]);
    void reload();
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Solicitar saque</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Valor mínimo R$ 50,00. O saldo é debitado quando o administrador aprovar.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="withdraw-bucket" className="text-xs font-medium text-text-secondary">
              Carteira de origem
            </label>
            <select
              id="withdraw-bucket"
              value={bucket}
              onChange={(e) => setBucket(e.target.value as WalletBucket)}
              className="flex h-9 w-full rounded-md border border-border-color bg-bg-secondary px-3 text-sm text-text-primary"
            >
              {WITHDRAWABLE_BUCKETS.map((b) => (
                <option key={b} value={b}>
                  {WALLET_BUCKET_LABELS[b]}
                </option>
              ))}
            </select>
            {selectedWallet ? (
              <p className="text-xs text-text-secondary">
                Disponível: {formatBrl(selectedWallet.availableBalance)}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="withdraw-amount" className="text-xs font-medium text-text-secondary">
              Valor (R$)
            </label>
            <Input
              id="withdraw-amount"
              type="number"
              min={50}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="withdraw-pix" className="text-xs font-medium text-text-secondary">
              Chave PIX
            </label>
            <Input
              id="withdraw-pix"
              required
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "A enviar…" : "Solicitar saque"}
            </Button>
          </div>
        </form>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">
          {isAdmin ? "Todos os saques" : "Os meus saques"}
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-text-secondary">A carregar…</p>
        ) : withdrawals.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">Nenhum saque registado.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5">Data</th>
                  {isAdmin ? <th className="px-3 py-2.5">Utilizador</th> : null}
                  <th className="px-3 py-2.5">Valor</th>
                  <th className="px-3 py-2.5">Origem</th>
                  <th className="px-3 py-2.5">PIX</th>
                  <th className="px-3 py-2.5">Status</th>
                  {isAdmin ? <th className="px-3 py-2.5">Acções</th> : null}
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((row) => (
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
                    <td className="px-3 py-2.5 text-text-secondary">
                      {WALLET_BUCKET_LABELS[row.bucket]}
                    </td>
                    <td className="max-w-[8rem] truncate px-3 py-2.5 text-text-secondary">
                      {row.pixKey ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <FinanceStatusBadge status={row.status} />
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
                        ) : row.status === "approved" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={processingId === row.id}
                            onClick={() => void handleProcess(row.id, "paid")}
                          >
                            Marcar pago
                          </Button>
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
