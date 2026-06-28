import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutomationPauseBanner } from "@/components/back-office/automation-pause-banner";
import {
  fetchAutomationConfig,
  saveAutomationConfig,
} from "@/lib/back-office/automation-config-api";
import type { GlobalAutomationConfigDto } from "@/lib/back-office/automation-config";
import { ROULETTE_AUTOMATION_BASE_STAKE } from "@/lib/back-office/rouletteAutomationSim";
import { useFormat } from "@/lib/i18n/use-format";

function parseOptionalMoney(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function BackOfficeAutomationConfigPanel() {
  const { money } = useFormat();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<GlobalAutomationConfigDto | null>(null);
  const [paused, setPaused] = useState(false);
  const [baseStake, setBaseStake] = useState(String(ROULETTE_AUTOMATION_BASE_STAKE));
  const [stopWin, setStopWin] = useState("");
  const [stopLoss, setStopLoss] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const row = await fetchAutomationConfig();
      if (row) {
        setConfig(row);
        setPaused(row.paused);
        setBaseStake(String(row.baseStake));
        setStopWin(row.stopWin != null ? String(row.stopWin) : "");
        setStopLoss(row.stopLoss != null ? String(row.stopLoss) : "");
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const stake = Number(baseStake);
    if (!Number.isFinite(stake) || stake < 1) {
      toast.error("Stake inicial inválido.");
      return;
    }
    setSaving(true);
    const result = await saveAutomationConfig({
      paused,
      baseStake: Math.round(stake),
      stopWin: parseOptionalMoney(stopWin),
      stopLoss: parseOptionalMoney(stopLoss),
    });
    setSaving(false);
    if (!result.ok || !result.config) {
      toast.error(result.error ?? "Não foi possível guardar.");
      return;
    }
    setConfig(result.config);
    toast.success("Configuração da automação guardada.");
  };

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
          <p className="text-[11px] text-text-secondary">Base do martingale: stake × 2^gale (máx. gale 5).</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor="auto-stop-win">
            Stop win (R$ de lucro vs capital)
          </label>
          <Input
            id="auto-stop-win"
            type="text"
            inputMode="decimal"
            placeholder="Desligado"
            value={stopWin}
            onChange={(e) => setStopWin(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor="auto-stop-loss">
            Stop loss (R$ de prejuízo vs capital)
          </label>
          <Input
            id="auto-stop-loss"
            type="text"
            inputMode="decimal"
            placeholder="Desligado"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "A guardar…" : "Guardar configuração"}
          </Button>
        </div>
      </form>
    </section>
  );
}
