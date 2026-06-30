import { Copy, Loader2, Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncProductPackagePixOrder } from "@/lib/back-office/product-api";
import type { PackagePixOrderDto } from "@/lib/back-office/product-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

type Props = {
  order: PackagePixOrderDto;
  packageName: string;
  onPaid: () => void;
};

export function StartPackPaymentBanner({ order, packageName, onPaid }: Props) {
  const { t } = useI18n();
  const { money } = useFormat();
  const [current, setCurrent] = useState(order);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!polling || current.status === "paid") return;

    const tick = async () => {
      const result = await syncProductPackagePixOrder(current.id);
      if (!result.ok) {
        if (result.error.includes("expirado")) setPolling(false);
        return;
      }
      setCurrent(result.order);
      if (result.order.status === "paid") {
        setPolling(false);
        toast.success(t("auth.activation.paidSuccess"));
        onPaid();
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => window.clearInterval(id);
  }, [current.id, current.status, onPaid, polling, t]);

  const copyPix = useCallback(async () => {
    if (!current.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(current.pixCopyPaste);
      toast.success(t("products.packages.pixCopied"));
    } catch {
      toast.error(t("products.packages.pixCopyFailed"));
    }
  }, [current.pixCopyPaste, t]);

  const qrSrc = current.qrCodeBase64
    ? current.qrCodeBase64.startsWith("data:")
      ? current.qrCodeBase64
      : `data:image/png;base64,${current.qrCodeBase64.replace(/\s/g, "")}`
    : null;

  if (current.status === "paid") {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/10 px-5 py-4 text-center">
        <p className="text-sm font-semibold text-success">{t("auth.activation.paidSuccess")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-warning/50 bg-gradient-to-b from-warning/10 to-bg-card shadow-lg">
      <div className="flex items-center gap-3 border-b border-warning/30 bg-warning/15 px-5 py-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/25 text-warning">
          <Package className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-warning">
            {t("auth.activation.bannerBadge")}
          </p>
          <h2 className="text-lg font-bold text-text-primary">{packageName}</h2>
          <p className="text-sm font-semibold tabular-nums text-warning">{money(current.amount)}</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-sm text-text-secondary">{t("auth.activation.bannerHint")}</p>

        <p className="rounded-lg border border-border-color bg-bg-secondary/60 px-3 py-2 text-xs text-text-secondary">
          {t("products.packages.pixAutomationAdminHint")}
        </p>

        {current.mode === "static" ? (
          <p className="rounded-lg border border-border-color bg-bg-secondary/60 px-3 py-2 text-xs text-text-secondary">
            {t("products.packages.pixStaticHint")}
          </p>
        ) : null}

        {qrSrc ? (
          <img
            src={qrSrc}
            alt={t("products.packages.pixQrAlt")}
            className="mx-auto h-56 w-56 rounded-xl border-4 border-white bg-white p-2 shadow-md"
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border-color">
            <Loader2 className="h-8 w-8 animate-spin text-text-secondary" aria-hidden />
          </div>
        )}

        {current.pixCopyPaste ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={current.pixCopyPaste}
              className="min-w-0 flex-1 rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-[11px] text-text-primary"
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => void copyPix()}>
              <Copy className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        <p className="flex items-center justify-center gap-2 text-center text-xs text-text-secondary">
          {polling ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t("products.packages.pixAwaitAdmin")}
            </>
          ) : (
            t("products.packages.pixExpired")
          )}
        </p>
      </div>
    </div>
  );
}
