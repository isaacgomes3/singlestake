import { useEffect, useState } from "react";

import { RESIDUAL_LEVELS } from "@/lib/back-office/constants";
import { DEFAULT_SUBSCRIPTION_AMOUNT, SUBSCRIPTION_NETWORK_SHARE } from "@/lib/back-office/product-constants";
import { fetchNetworkBonuses } from "@/lib/back-office/network-api";
import type { NetworkBonusesData } from "@/lib/back-office/network-types";
import { formatBrl } from "@/lib/back-office/mock-data";

const RANK_LABELS: Record<string, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
  imperial: "Imperial",
};

export function BackOfficeTeamBonusPanel() {
  const [data, setData] = useState<NetworkBonusesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchNetworkBonuses().then((row) => {
      setData(row);
      setLoading(false);
    });
  }, []);

  const team = data?.team;

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Indicadores da equipe</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Activos na rede", value: team?.activeInNetwork ?? 0 },
            { label: "Directos activos", value: team?.directActive ?? 0 },
            {
              label: "Volume da rede",
              value: loading ? "…" : formatBrl(team?.networkVolume ?? 0),
            },
            {
              label: "Sua graduação",
              value: team ? (RANK_LABELS[team.qualification] ?? team.qualification) : "…",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{item.label}</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Ganhos de afiliação</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">Total creditado (extrato)</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
              {loading ? "…" : formatBrl(team?.affiliateEarnings ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">Saldo carteira afiliados</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
              {loading ? "…" : formatBrl(team?.walletBalance ?? 0)}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          O bónus de equipe considera volume, activos na rede e graduação mínima. Os créditos
          entram na carteira de afiliados conforme as regras de indicação.
        </p>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Residual de mensalidade</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Quando um afiliado na sua rede paga a mensalidade ({formatBrl(DEFAULT_SUBSCRIPTION_AMOUNT)}),
          {` ${Math.round(SUBSCRIPTION_NETWORK_SHARE * 100)}%`} entra na rede e é repartido em até 10
          níveis conforme a tabela abaixo.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-color bg-bg-secondary text-xs text-text-secondary">
                <th className="px-3 py-2 font-semibold">Nível</th>
                <th className="px-3 py-2 font-semibold">Percentual</th>
                <th className="px-3 py-2 font-semibold">Sobre parte rede</th>
              </tr>
            </thead>
            <tbody>
              {RESIDUAL_LEVELS.map((row) => {
                const networkPart = DEFAULT_SUBSCRIPTION_AMOUNT * SUBSCRIPTION_NETWORK_SHARE;
                const payout = (networkPart * row.percent) / 100;
                return (
                  <tr key={row.level} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-text-primary">{row.level}</td>
                    <td className="px-3 py-2.5 tabular-nums text-text-primary">{row.percent}%</td>
                    <td className="px-3 py-2.5 tabular-nums text-text-primary">
                      {formatBrl(payout)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
