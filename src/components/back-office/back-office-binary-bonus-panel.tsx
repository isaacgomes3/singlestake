import { useEffect, useState } from "react";



import { fetchNetworkBonuses } from "@/lib/back-office/network-api";

import type { NetworkBonusesData } from "@/lib/back-office/network-types";

import { formatBrl } from "@/lib/back-office/mock-data";



export function BackOfficeBinaryBonusPanel() {

  const [data, setData] = useState<NetworkBonusesData | null>(null);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    void fetchNetworkBonuses().then((row) => {

      setData(row);

      setLoading(false);

    });

  }, []);



  const points = data?.binaryPoints;



  return (

    <div className="space-y-5">

      <section className="theme-card rounded-2xl p-5">

        <h2 className="text-sm font-bold text-text-primary">Regras do binário</h2>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">

          <table className="w-full min-w-[320px] text-left text-sm">

            <tbody>

              {[

                ["Pontuação", `1 ponto = ${formatBrl(points?.pointsPerReal ?? 1)}`],

                ["Conversão em crédito", `${points?.payoutPercent ?? 10}% dos pontos emparelhados`],

                [

                  "Activação global",

                  loading

                    ? "…"

                    : points?.globallyActive

                      ? "Activo — Start R$ 50 em cada perna (nível 1)"

                      : "Pendente — requer Start R$ 50 em cada perna",

                ],

                ["Carteira de crédito", "Rede (afiliados)"],

              ].map(([label, value]) => (

                <tr key={label} className="border-b border-border-color/60 last:border-0">

                  <td className="px-3 py-2.5 text-text-secondary">{label}</td>

                  <td className="px-3 py-2.5 font-semibold text-text-primary">{value}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </section>



      <section className="theme-card rounded-2xl p-5">

        <h2 className="text-sm font-bold text-text-primary">Teto de lucro (200%)</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {[

            { label: "Investido", value: points?.profitCap.invested ?? 0 },

            { label: "Teto anual", value: points?.profitCap.cap ?? 0 },

            { label: "Já recebido", value: points?.profitCap.earned ?? 0 },

            { label: "Disponível", value: points?.profitCap.remaining ?? 0 },

          ].map((item) => (

            <div

              key={item.label}

              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"

            >

              <p className="text-xs text-text-secondary">{item.label}</p>

              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">

                {loading ? "…" : formatBrl(item.value)}

              </p>

            </div>

          ))}

        </div>

      </section>



      <section className="theme-card rounded-2xl p-5">

        <h2 className="text-sm font-bold text-text-primary">Pontos disponíveis por perna</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">

          {[

            { label: "Esquerda", value: data?.binary.leftPoints ?? 0 },

            { label: "Direita", value: data?.binary.rightPoints ?? 0 },

            { label: "Estimativa pendente", value: data?.binary.estimatedPayout ?? 0 },

          ].map((item) => (

            <div

              key={item.label}

              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"

            >

              <p className="text-xs text-text-secondary">{item.label}</p>

              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">

                {loading ? "…" : formatBrl(item.value)}

              </p>

            </div>

          ))}

        </div>

      </section>



      <section className="theme-card rounded-2xl p-5">

        <h2 className="text-sm font-bold text-text-primary">Pontuação por nível</h2>

        <p className="mt-1 text-xs text-text-secondary">

          Cada nível exige Start R$ 50 da sua conta em ambas as pernas para qualificar e gerar

          bónus.

        </p>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">

          <table className="w-full min-w-[640px] text-left text-sm">

            <thead>

              <tr className="border-b border-border-color bg-bg-secondary text-xs text-text-secondary">

                <th className="px-3 py-2 font-semibold">Nível</th>

                <th className="px-3 py-2 font-semibold">Esquerda</th>

                <th className="px-3 py-2 font-semibold">Direita</th>

                <th className="px-3 py-2 font-semibold">Qualificado</th>

                <th className="px-3 py-2 font-semibold">Pode formar</th>

                <th className="px-3 py-2 font-semibold">Estimativa</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td colSpan={6} className="px-3 py-4 text-text-secondary">

                    A carregar…

                  </td>

                </tr>

              ) : (

                (points?.levels ?? []).map((level) => (

                  <tr key={level.level} className="border-b border-border-color/60 last:border-0">

                    <td className="px-3 py-2.5 font-semibold text-text-primary">{level.level}</td>

                    <td className="px-3 py-2.5 tabular-nums text-text-primary">

                      {formatBrl(level.left.available)}{" "}

                      <span className="text-xs text-text-secondary">

                        / {formatBrl(level.left.total)}

                      </span>

                    </td>

                    <td className="px-3 py-2.5 tabular-nums text-text-primary">

                      {formatBrl(level.right.available)}{" "}

                      <span className="text-xs text-text-secondary">

                        / {formatBrl(level.right.total)}

                      </span>

                    </td>

                    <td className="px-3 py-2.5">

                      {level.qualified ? (

                        <span className="text-emerald-600">Sim</span>

                      ) : (

                        <span className="text-amber-600">Não</span>

                      )}

                    </td>

                    <td className="px-3 py-2.5">

                      {level.canMatch ? (

                        <span className="text-emerald-600">Sim</span>

                      ) : (

                        <span className="text-text-secondary">—</span>

                      )}

                    </td>

                    <td className="px-3 py-2.5 tabular-nums font-semibold text-text-primary">

                      {formatBrl(level.potentialPayout)}

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </section>



      <section className="theme-card rounded-2xl p-5">

        <h2 className="text-sm font-bold text-text-primary">Histórico binário</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">

          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">

            <p className="text-xs text-text-secondary">Total pago (extrato)</p>

            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">

              {loading ? "…" : formatBrl(data?.binary.paidTotal ?? 0)}

            </p>

          </div>

          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">

            <p className="text-xs text-text-secondary">Saldo carteira rede</p>

            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">

              {loading ? "…" : formatBrl(data?.binary.walletBalance ?? 0)}

            </p>

          </div>

        </div>

      </section>

    </div>

  );

}


