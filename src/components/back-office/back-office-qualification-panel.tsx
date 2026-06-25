import { useEffect, useState } from "react";
import { Check, Circle } from "lucide-react";

import { QUALIFICATION_RANKS } from "@/lib/back-office/constants";
import { fetchQualification } from "@/lib/back-office/network-api";
import type { QualificationProgress } from "@/lib/back-office/network-types";
import { formatBrl } from "@/lib/back-office/mock-data";
import { cn } from "@/lib/utils";

export function BackOfficeQualificationPanel() {
  const [data, setData] = useState<QualificationProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchQualification().then((row) => {
      setData(row);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Graduação actual</h2>
        <p className="mt-2 text-3xl font-bold text-text-primary">
          {loading ? "…" : (data?.currentLabel ?? "Bronze")}
        </p>
        {data?.nextRank ? (
          <p className="mt-2 text-sm text-text-secondary">
            Próxima meta: <span className="font-semibold text-text-primary">{data.nextLabel}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-emerald-400">Graduação máxima atingida.</p>
        )}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">O seu progresso</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Directos", value: data?.progress.directCount ?? 0 },
            { label: "Directos activos", value: data?.progress.directActive ?? 0 },
            {
              label: "Volume da rede",
              value: loading ? "…" : formatBrl(data?.progress.networkVolume ?? 0),
            },
            {
              label: "Mensalidade",
              value: data?.progress.subscriptionActive ? "Activa" : "Pendente",
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

        {data && data.missingForNext.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-sm text-text-secondary">
            {data.missingForNext.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Circle className="size-3.5 shrink-0 text-amber-400" />
                Falta: {item}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Níveis de graduação</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.requirements ?? []).map((req) => {
            const rankOrder = QUALIFICATION_RANKS.map((r) => r.id);
            const currentIdx = data ? rankOrder.indexOf(data.current) : -1;
            const reqIdx = rankOrder.indexOf(req.rank);
            const achieved = currentIdx >= 0 && reqIdx <= currentIdx;
            const isCurrent = data?.current === req.rank;
            return (
              <div
                key={req.rank}
                className={cn(
                  "rounded-xl border px-4 py-3",
                  isCurrent
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-border-color bg-bg-secondary",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-text-primary">{req.label}</p>
                  {achieved ? <Check className="size-4 text-emerald-400" /> : null}
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-text-secondary">
                  <li>{req.minDirect} directo(s)</li>
                  <li>{req.minDirectActive} directo(s) com pacote</li>
                  <li>Volume {formatBrl(req.minNetworkVolume)}</li>
                  {req.requiresSubscription ? <li>Mensalidade activa</li> : null}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
