import { useEffect, useState } from "react";

import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { fetchAffiliates } from "@/lib/back-office/network-api";
import type { AffiliatesData } from "@/lib/back-office/network-types";
import { formatBrl } from "@/lib/back-office/mock-data";

const RANK_LABELS: Record<string, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
  imperial: "Imperial",
};

export function BackOfficeAffiliatesPanel() {
  const [data, setData] = useState<AffiliatesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchAffiliates().then((row) => {
      setData(row);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">O seu link de indicação</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Partilhe este link para registar novos afiliados na sua rede.
        </p>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-text-secondary">A carregar…</p>
          ) : data ? (
            <ReferralLinkField
              referralCode={data.referralCode}
              referralLink={data.referralLink}
            />
          ) : null}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Resumo da rede</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Directos", value: data?.totals.directCount ?? 0 },
            { label: "Rede total", value: data?.totals.networkCount ?? 0 },
            { label: "Activos na rede", value: data?.totals.activeInNetwork ?? 0 },
            {
              label: "Volume da rede",
              value: loading ? "…" : formatBrl(data?.totals.networkVolume ?? 0),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{item.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Comissões por nível</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                <th className="px-3 py-2.5 font-semibold">Nível</th>
                <th className="px-3 py-2.5 font-semibold">Percentual</th>
                <th className="px-3 py-2.5 font-semibold">Afiliados</th>
                <th className="px-3 py-2.5 font-semibold">Activos</th>
                <th className="px-3 py-2.5 font-semibold">Volume</th>
              </tr>
            </thead>
            <tbody>
              {(data?.indirect ?? []).map((row) => (
                <tr key={row.level} className="border-b border-border-color/60 last:border-0">
                  <td className="px-3 py-2.5 text-text-primary">
                    {row.level} ({row.level === 1 ? "Directo" : "Indirecto"})
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-text-primary">{row.percent}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-text-primary">{row.count}</td>
                  <td className="px-3 py-2.5 tabular-nums text-text-primary">{row.activeCount}</td>
                  <td className="px-3 py-2.5 tabular-nums text-text-primary">
                    {formatBrl(row.volume)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Indicados directos</h2>
        {loading ? (
          <p className="mt-3 text-sm text-text-secondary">A carregar…</p>
        ) : (data?.direct.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
            Ainda não tem indicados directos. Partilhe o seu link de convite.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">Nome</th>
                  <th className="px-3 py-2.5 font-semibold">Entrada</th>
                  <th className="px-3 py-2.5 font-semibold">Graduação</th>
                  <th className="px-3 py-2.5 font-semibold">Pacote</th>
                  <th className="px-3 py-2.5 font-semibold">Mensalidade</th>
                </tr>
              </thead>
              <tbody>
                {data!.direct.map((member) => (
                  <tr key={member.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-primary">{member.name}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{member.joinedAt}</td>
                    <td className="px-3 py-2.5 text-text-primary">
                      {RANK_LABELS[member.qualification] ?? member.qualification}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-text-primary">
                      {member.hasActivePackage ? formatBrl(member.packageAmount) : "—"}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-text-primary">
                      {member.subscriptionStatus}
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
