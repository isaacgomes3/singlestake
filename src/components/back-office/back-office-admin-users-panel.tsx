import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { Button } from "@/components/ui/button";
import { copyText, fetchUsersWithReferralLinks } from "@/lib/back-office/admin-api";
import { getSession } from "@/lib/auth/session";
import type { UserReferralRecord } from "@/lib/back-office/admin-types";

export function BackOfficeAdminUsersPanel() {
  const isAdmin = getSession()?.user.role === "admin";
  const [users, setUsers] = useState<UserReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void fetchUsersWithReferralLinks().then((rows) => {
      setUsers(rows);
      setLoading(false);
    });
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <p className="text-sm text-text-secondary">
        Apenas administradores podem ver os links de todos os utilizadores.
      </p>
    );
  }

  const copyLink = async (link: string) => {
    const ok = await copyText(link);
    toast[ok ? "success" : "error"](ok ? "Link copiado." : "Não foi possível copiar.");
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">O seu link de afiliação</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Cada utilizador recebe automaticamente um código único ao criar conta.
        </p>
        {getSession()?.user.referralCode ? (
          <div className="mt-4">
            <ReferralLinkField
              referralCode={getSession()!.user.referralCode}
              referralLink={getSession()?.user.referralLink}
            />
          </div>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Links por utilizador</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {loading
            ? "A carregar…"
            : `${users.length} utilizador(es) com link de indicação gerado.`}
        </p>

        {loading ? null : users.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">Nenhum utilizador encontrado.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">Nome</th>
                  <th className="px-3 py-2.5 font-semibold">E-mail</th>
                  <th className="px-3 py-2.5 font-semibold">Código</th>
                  <th className="px-3 py-2.5 font-semibold">Entrada</th>
                  <th className="px-3 py-2.5 font-semibold">Link</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-primary">
                      {row.name}
                      {row.role === "admin" ? (
                        <span className="ml-1.5 text-[10px] uppercase text-violet-400">admin</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.email}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-primary">
                      {row.referralCode}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.createdAt}</td>
                    <td className="px-3 py-2.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void copyLink(row.referralLink)}
                      >
                        <Copy className="size-3.5" />
                        Copiar
                      </Button>
                    </td>
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
