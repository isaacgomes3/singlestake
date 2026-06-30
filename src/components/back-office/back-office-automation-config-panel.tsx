import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutomationPauseBanner } from "@/components/back-office/automation-pause-banner";
import {
  fetchAutomationConfig,
  resetAutomationCycle,
  saveAutomationConfig,
} from "@/lib/back-office/automation-config-api";
import type { GlobalAutomationConfigDto } from "@/lib/back-office/automation-config";
import { ROULETTE_AUTOMATION_BASE_STAKE } from "@/lib/back-office/rouletteAutomationSim";
import { isAdminUser } from "@/lib/back-office/admin-access";
import { getSession } from "@/lib/auth/session";
import { useFormat } from "@/lib/i18n/use-format";
import { useI18n } from "@/lib/i18n/i18n-provider";

export function BackOfficeAutomationConfigPanel() {
  const { t } = useI18n();
  const { money } = useFormat();
  const isAdmin = isAdminUser(getSession()?.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [config, setConfig] = useState<GlobalAutomationConfigDto | null>(null);
  const [paused, setPaused] = useState(false);
  const [baseStake, setBaseStake] = useState(String(ROULETTE_AUTOMATION_BASE_STAKE));

  const [yieldPct, setYieldPct] = useState("1");
  const [savingYield, setSavingYield] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const [row, yieldRes] = await Promise.all([
        fetchAutomationConfig(),
        fetch("/api/back-office/admin/automation-yield-pct", { credentials: "include" }).then((r) =>
          r.json(),
        ),
      ]);
      if (row) {
        setConfig(row);
        setPaused(row.paused);
        setBaseStake(String(row.baseStake));
      }
      if (yieldRes?.ok && yieldRes.pct != null) {
        setYieldPct(String(yieldRes.pct));
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const stake = Number(baseStake);
    if (!Number.isFinite(stake) || stake < 1) {
      toast.error("Stake inicial inválido (mínimo R$ 1).");
      return;
    }
    setSaving(true);
    const result = await saveAutomationConfig({
      paused,
      baseStake: Math.round(stake),
      stopWin: null,
      stopLoss: null,
    });
    setSaving(false);
    if (!result.ok || !result.config) {
      toast.error(result.error ?? "Não foi possível guardar.");
      return;
    }
    setConfig(result.config);
    toast.success("Configuração da automação guardada.");
  };

  const handleResetCycle = async () => {
    if (
      !window.confirm(
        "Repor saldo inicial (R$ 50.000) e apagar todo o histórico da automação? Esta acção não pode ser desfeita.",
      )
    ) {
      return;
    }
    setResetting(true);
    const result = await resetAutomationCycle();
    setResetting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Não foi possível reiniciar o ciclo.");
      return;
    }
    toast.success(result.message ?? "Ciclo reiniciado.");
    const row = await fetchAutomationConfig();
    if (row) {
      setConfig(row);
      setPaused(row.paused);
    }
  };

  if (!isAdmin) {
    return <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>;
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">A carregar configuração…</p>;
  }

  return (
    <section className="theme-card space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="text-sm font-bold text-text-primary">Automação global — configuração</h2>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Controla apenas a <strong className="font-semibold text-text-primary">automação financeira</strong>{" "}
          (entradas automáticas na carteira operacional). A{" "}
          <strong className="font-semibold text-text-primary">sala rotativa</strong>, a{" "}
          <strong className="font-semibold text-text-primary">extensão Chrome</strong> ligada à sala e os
          cartões do <strong className="font-semibold text-text-primary">Casino ao vivo</strong> continuam a
          funcionar normalmente — sinais, gatilhos e indicações 1 Fator permanecem activos.
        </p>
      </div>

      {config ? (
        <>
          <AutomationPauseBanner config={config} />
          <div className="grid gap-2 rounded-xl border border-border-color bg-bg-secondary/60 px-3 py-2.5 text-xs sm:grid-cols-3">
            <p className="text-text-secondary">
              Saldo operacional:{" "}
              <span className="font-semibold tabular-nums text-text-primary">{money(config.balance)}</span>
            </p>
            <p className="text-text-secondary">
              P/L vs capital:{" "}
              <span
                className={
                  config.profitVsCapital >= 0
                    ? "font-semibold tabular-nums text-success"
                    : "font-semibold tabular-nums text-danger"
                }
              >
                {config.profitVsCapital >= 0 ? "+" : ""}
                {money(config.profitVsCapital)}
              </span>
            </p>
          </div>
        </>
      ) : null}

      <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={paused}
              onChange={(e) => setPaused(e.target.checked)}
            />
            Pausar automação global (sem novas entradas automáticas)
          </label>
          <p className="text-[11px] text-text-secondary">
            Gatilho Fibonacci e giros de ausência: painel{" "}
            <strong className="font-semibold text-text-primary">Estatísticas automação</strong>.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor="auto-base-stake">
            Stake inicial (R$)
          </label>
          <Input
            id="auto-base-stake"
            type="number"
            min={1}
            step={1}
            value={baseStake}
            onChange={(e) => setBaseStake(e.target.value)}
          />
          <p className="text-[11px] text-text-secondary">
            Base do martingale: stake × 2^gale (máx. gale 5). Deve coincidir com a ficha da extensão (R$ 50).
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor="auto-daily-yield">
            Rendimento diário pacotes automação (%)
          </label>
          <Input
            id="auto-daily-yield"
            type="number"
            min={0.01}
            max={100}
            step={0.01}
            value={yieldPct}
            onChange={(e) => setYieldPct(e.target.value)}
          />
          <p className="text-[11px] text-text-secondary">
            Percentual pago às 00h sobre o valor de cada cota de automação (base 1%). Não confundir com o
            saldo operacional da sala rotativa.
          </p>
        </div>

        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || resetting || savingYield}>
            {saving ? "A guardar…" : "Guardar configuração"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving || resetting || savingYield}
            onClick={() => {
              void (async () => {
                const pct = Number(yieldPct);
                if (!Number.isFinite(pct) || pct <= 0) {
                  toast.error("Percentual de rendimento inválido.");
                  return;
                }
                setSavingYield(true);
                const res = await fetch("/api/back-office/admin/automation-yield-pct", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ pct }),
                });
                const data = await res.json();
                setSavingYield(false);
                if (!data?.ok) {
                  toast.error(data?.error ?? "Não foi possível guardar o rendimento.");
                  return;
                }
                setYieldPct(String(data.pct));
                toast.success(`Rendimento diário: ${data.pct}%`);
              })();
            }}
          >
            {savingYield ? "A guardar…" : "Guardar rendimento diário"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || resetting}
            onClick={() => void handleResetCycle()}
          >
            {resetting ? "A reiniciar…" : "Reiniciar ciclo (saldo + histórico)"}
          </Button>
        </div>
      </form>
    </section>
  );
}
