import { useEffect, useState } from "react";

import { BinaryTreeView } from "@/components/back-office/binary-tree-view";
import { BackOfficeSubAccountsPanel } from "@/components/back-office/back-office-sub-accounts-panel";
import { fetchBinaryNetwork } from "@/lib/back-office/network-api";
import type { BinaryNetworkData } from "@/lib/back-office/network-types";
import { formatBrl } from "@/lib/back-office/mock-data";

export function BackOfficeBinaryPanel() {
  const [data, setData] = useState<BinaryNetworkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchBinaryNetwork().then((row) => {
      setData(row);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Posicionamento na árvore</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">Patrocinador binário</p>
            <p className="mt-1 font-semibold text-text-primary">
              {loading ? "…" : (data?.placement.parentName ?? "Raiz")}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">Lado</p>
            <p className="mt-1 font-semibold text-text-primary">
              {loading
                ? "…"
                : data?.placement.side === "left"
                  ? "Esquerdo"
                  : data?.placement.side === "right"
                    ? "Direito"
                    : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3">
            <p className="text-xs text-text-secondary">Posicionado em</p>
            <p className="mt-1 font-semibold text-text-primary">
              {loading ? "…" : (data?.placement.placedAt ?? "—")}
            </p>
          </div>
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Volume por perna</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Esquerda",
              count: data?.legs.left.count ?? 0,
              volume: data?.legs.left.volume ?? 0,
            },
            {
              label: "Direita",
              count: data?.legs.right.count ?? 0,
              volume: data?.legs.right.volume ?? 0,
            },
            {
              label: "Menor perna",
              count: null,
              volume: data?.legs.weakerVolume ?? 0,
            },
          ].map((leg) => (
            <div
              key={leg.label}
              className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
            >
              <p className="text-xs text-text-secondary">{leg.label}</p>
              {leg.count !== null ? (
                <p className="mt-0.5 text-xs text-text-secondary">{leg.count} nó(s)</p>
              ) : null}
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {loading ? "…" : formatBrl(leg.volume)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <BackOfficeSubAccountsPanel />

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Genealogia (3 níveis)</h2>
        <div className="mt-3">
          {loading || !data ? (
            <p className="text-sm text-text-secondary">A carregar árvore…</p>
          ) : (
            <BinaryTreeView root={data.root} />
          )}
        </div>
      </section>
    </div>
  );
}
