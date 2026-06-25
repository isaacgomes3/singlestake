import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  fetchProductPackages,
  fetchUserPackages,
  purchaseProductPackage,
} from "@/lib/back-office/product-api";
import type { PackageDto, UserPackageDto } from "@/lib/back-office/product-types";
import {
  AUTOMATION_DEPOSIT_STEP,
  PACKAGE_SPLIT_AUTOMATION,
  PACKAGE_SPLIT_START,
  START_PACKAGE_AMOUNT,
} from "@/lib/back-office/product-constants";
import { formatBrl } from "@/lib/back-office/mock-data";
import { getSession } from "@/lib/auth/session";
import { runDailyAutomationYield } from "@/lib/back-office/product-api";

export function BackOfficePackagesPanel() {
  const isAdmin = getSession()?.user.role === "admin";
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [mine, setMine] = useState<UserPackageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [runningYield, setRunningYield] = useState(false);
  const [customAmount, setCustomAmount] = useState("500");

  const hasStart = mine.some((p) => p.packageId === "start" && p.status === "active");

  const reload = async () => {
    setLoading(true);
    const [packages, owned] = await Promise.all([fetchProductPackages(), fetchUserPackages()]);
    setCatalog(packages);
    setMine(owned);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleBuy = async (packageId: string, amount?: number) => {
    setBuyingId(packageId);
    const result = await purchaseProductPackage(packageId, amount);
    setBuyingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pacote adquirido. Divisão aplicada nas carteiras.");
    void reload();
  };

  const handleRunYield = async () => {
    setRunningYield(true);
    const result = await runDailyAutomationYield();
    setRunningYield(false);
    if (!result.ok) {
      toast.error(result.error ?? "Falha ao processar rendimento.");
      return;
    }
    toast.success(
      `Rendimento ${result.result?.yieldPct}% — creditado ${formatBrl(result.result?.credited ?? 0)}`,
    );
    void reload();
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Divisão dos pacotes</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3 text-sm">
            <p className="font-semibold text-text-primary">Com automação</p>
            <p className="mt-1 text-text-secondary">
              Afiliados {PACKAGE_SPLIT_AUTOMATION.afiliados * 100}% · Automação{" "}
              {PACKAGE_SPLIT_AUTOMATION.automacao * 100}% · Empresa{" "}
              {PACKAGE_SPLIT_AUTOMATION.empresa * 100}%
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3 text-sm">
            <p className="font-semibold text-text-primary">Start (R$ 50)</p>
            <p className="mt-1 text-text-secondary">
              Afiliados {PACKAGE_SPLIT_START.afiliados * 100}% · Empresa{" "}
              {PACKAGE_SPLIT_START.empresa * 100}% (sem automação)
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          Pack Start {formatBrl(START_PACKAGE_AMOUNT)} obrigatório antes de qualquer depósito de
          automação. Valores de automação em múltiplos de {formatBrl(AUTOMATION_DEPOSIT_STEP)}.
          Lucro máximo 200% do valor aportado · adesão 1 ano · rendimento diário até 1% sobre a base
          de automação (automação global). Processamento automático às 00:05 (horário de Brasília)
          enquanto o servidor estiver activo.
        </p>
        {isAdmin ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            disabled={runningYield}
            onClick={() => void handleRunYield()}
          >
            {runningYield ? "A processar…" : "Processar rendimento diário (admin)"}
          </Button>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Catálogo</h2>
        {!hasStart && mine.length > 0 ? (
          <p className="mt-2 text-xs text-amber-600">
            Active o Pacote Start para desbloquear depósitos de automação.
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {loading
            ? "A carregar…"
            : catalog.map((pkg) => {
                const isAutomation = pkg.packageKind === "automation";
                const locked = isAutomation && !hasStart;
                return (
                  <div
                    key={pkg.id}
                    className="rounded-xl border border-border-color bg-bg-secondary px-4 py-3"
                  >
                    <p className="font-semibold text-text-primary">{pkg.name}</p>
                    {pkg.allowsCustomAmount ? (
                      <div className="mt-2">
                        <label className="text-xs text-text-secondary">
                          Valor (múltiplos de {formatBrl(AUTOMATION_DEPOSIT_STEP)})
                        </label>
                        <input
                          type="number"
                          min={pkg.minAmount}
                          max={pkg.maxAmount}
                          step={AUTOMATION_DEPOSIT_STEP}
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-border-color bg-bg-primary px-3 py-2 text-sm tabular-nums text-text-primary"
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-lg font-bold tabular-nums">{formatBrl(pkg.amount)}</p>
                    )}
                    <p className="mt-1 text-xs text-text-secondary">
                      {pkg.packageKind === "start"
                        ? "Entrada obrigatória · sem automação"
                        : locked
                          ? "Requer Pack Start activo"
                          : "Com automação · rendimento só sobre a base"}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      disabled={buyingId === pkg.id || locked}
                      onClick={() =>
                        void handleBuy(
                          pkg.id,
                          pkg.allowsCustomAmount ? Number(customAmount) : undefined,
                        )
                      }
                    >
                      {buyingId === pkg.id ? "A comprar…" : "Comprar com saldo"}
                    </Button>
                  </div>
                );
              })}
        </div>
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">Os seus pacotes</h2>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">Nenhum pacote activo.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5">Pacote</th>
                  <th className="px-3 py-2.5">Valor</th>
                  <th className="px-3 py-2.5">Base automação</th>
                  <th className="px-3 py-2.5">Ganhos</th>
                  <th className="px-3 py-2.5">Teto (200%)</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-primary">{row.packageName}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBrl(row.amount)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBrl(row.automationBase)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBrl(row.totalEarned)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBrl(row.maxProfit)}</td>
                    <td className="px-3 py-2.5 capitalize">{row.status}</td>
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
