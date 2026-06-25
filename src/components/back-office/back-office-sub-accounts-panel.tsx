import { useCallback, useEffect, useState } from "react";

import { BINARY_MAX_LEVELS } from "@/lib/back-office/binary-constants";
import { formatBrl } from "@/lib/back-office/mock-data";
import {
  createSubAccount,
  fetchSubAccounts,
  purchaseSubAccountStart,
} from "@/lib/back-office/network-api";
import type { SubAccountView } from "@/lib/back-office/network-types";
import { PRODUCT_PACKAGES } from "@/lib/back-office/product-constants";

const START_AMOUNT =
  PRODUCT_PACKAGES.find((p) => p.id === "start")?.minAmount ?? 50;

export function BackOfficeSubAccountsPanel() {
  const [items, setItems] = useState<SubAccountView[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(
    null,
  );

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState(1);
  const [legSide, setLegSide] = useState<"left" | "right">("left");

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await fetchSubAccounts();
    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedCreds(null);
    setSubmitting(true);

    const result = await createSubAccount({ name, password, level, legSide });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCreatedCreds(result.credentials);
    setName("");
    setPassword("");
    await reload();
  }

  async function handleActivateStart(subAccountId: string, subName: string) {
    setError(null);
    setSuccess(null);
    setActivatingId(subAccountId);

    const result = await purchaseSubAccountStart(subAccountId);
    setActivatingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(`Pacote Start activado em «${subName}». O valor foi debitado da sua carteira de caixa.`);
    await reload();
  }

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Sub-contas de qualificação</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Crie contas suas posicionadas num nível e perna específicos. Active o Pacote Start (
          {formatBrl(START_AMOUNT)}) directamente da sua carteira de caixa, sem precisar de login
          na sub-conta.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-text-secondary">Nome</span>
            <input
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Qualificação nível 2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Senha</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Nível na perna</span>
            <select
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            >
              {Array.from({ length: BINARY_MAX_LEVELS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Nível {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-text-secondary">Perna</span>
            <select
              className="mt-1 w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary"
              value={legSide}
              onChange={(e) => setLegSide(e.target.value as "left" | "right")}
            >
              <option value="left">Esquerda</option>
              <option value="right">Direita</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            {error ? <p className="mb-2 text-sm text-red-500">{error}</p> : null}
            {success ? <p className="mb-2 text-sm text-emerald-600">{success}</p> : null}
            {createdCreds ? (
              <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-text-primary">
                <p className="font-semibold">Sub-conta criada — guarde as credenciais:</p>
                <p className="mt-1">
                  E-mail: <span className="font-mono">{createdCreds.email}</span>
                </p>
                <p>
                  Senha: <span className="font-mono">{createdCreds.password}</span>
                </p>
                <p className="mt-2 text-xs text-text-secondary">
                  Pode activar o Start na tabela abaixo ou fazer login nesta conta mais tarde.
                </p>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "A criar…" : "Criar sub-conta"}
            </button>
          </div>
        </form>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Sub-contas activas</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-color bg-bg-secondary text-xs text-text-secondary">
                <th className="px-3 py-2 font-semibold">Nome</th>
                <th className="px-3 py-2 font-semibold">Nível</th>
                <th className="px-3 py-2 font-semibold">Perna</th>
                <th className="px-3 py-2 font-semibold">Start activo</th>
                <th className="px-3 py-2 font-semibold">E-mail</th>
                <th className="px-3 py-2 font-semibold">Acção</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-text-secondary">
                    A carregar…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-text-secondary">
                    Nenhuma sub-conta criada.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-text-primary">{row.name}</td>
                    <td className="px-3 py-2.5 text-text-primary">{row.level}</td>
                    <td className="px-3 py-2.5 text-text-primary">
                      {row.legSide === "left" ? "Esquerda" : "Direita"}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.hasActiveStart ? (
                        <span className="text-emerald-600">Sim</span>
                      ) : (
                        <span className="text-amber-600">Pendente</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">
                      {row.email}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.hasActiveStart ? (
                        <span className="text-xs text-text-secondary">—</span>
                      ) : (
                        <button
                          type="button"
                          disabled={activatingId === row.id}
                          onClick={() => void handleActivateStart(row.id, row.name)}
                          className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60"
                        >
                          {activatingId === row.id
                            ? "A activar…"
                            : `Activar Start (${formatBrl(START_AMOUNT)})`}
                        </button>
                      )}
                    </td>
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
