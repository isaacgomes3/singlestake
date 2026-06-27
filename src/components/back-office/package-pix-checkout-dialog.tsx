import { Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncProductPackagePixOrder } from "@/lib/back-office/product-api";
import type { PackagePixOrderDto } from "@/lib/back-office/product-types";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { useFormat } from "@/lib/i18n/use-format";

type Props = {
  order: PackagePixOrderDto;
  packageName: string;
  onClose: () => void;
  onPaid: () => void;
};

export function PackagePixCheckoutDialog({ order, packageName, onClose, onPaid }: Props) {
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
        toast.success(t("products.packages.toastPixPaid"));
        onPaid();
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => window.clearInterval(id);
  }, [current.id, current.status, onPaid, polling, t]);

  const copyPix = async () => {
    if (!current.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(current.pixCopyPaste);
      toast.success(t("products.packages.pixCopied"));
    } catch {
      toast.error(t("products.packages.pixCopyFailed"));
    }
  };

  const qrSrc = current.qrCodeBase64
    ? current.qrCodeBase64.startsWith("data:")
      ? current.qrCodeBase64
      : `data:image/png;base64,${current.qrCodeBase64}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pix-checkout-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border-color bg-bg-primary p-5 shadow-xl">
        <button
          type="button"
          className="absolute right-3 top-3 rounded-lg p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="pix-checkout-title" className="pr-8 text-sm font-bold text-text-primary">
          {t("products.packages.pixTitle")}
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {packageName} · {money(current.amount)}
        </p>

        {current.status === "paid" ? (
          <p className="mt-4 text-sm font-medium text-emerald-400">{t("products.packages.pixPaid")}</p>
        ) : (
          <>
            {current.mode === "static" &&
            current.pixFixedAmount != null &&
            Math.abs(current.pixFixedAmount - current.amount) > 0.009 ? (
              <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {t("products.packages.pixStaticAmountWarning", {
                  pixAmount: money(current.pixFixedAmount),
                  packageAmount: money(current.amount),
                })}
              </p>
            ) : null}
            {current.mode === "static" ? (
              <p className="mt-2 text-xs text-text-secondary">{t("products.packages.pixStaticHint")}</p>
            ) : null}
            {qrSrc ? (
              <img
                src={qrSrc}
                alt={t("products.packages.pixQrAlt")}
                className="mx-auto mt-4 h-52 w-52 rounded-xl border border-border-color bg-white p-2"
              />
            ) : null}
            <p className="mt-3 text-xs text-text-secondary">{t("products.packages.pixHint")}</p>
            {current.pixCopyPaste ? (
              <div className="mt-3 flex gap-2">
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
            <p className="mt-3 text-center text-xs text-text-secondary">
              {polling ? t("products.packages.pixWaiting") : t("products.packages.pixExpired")}
            </p>
          </>
        )}

        <Button type="button" className="mt-4 w-full" variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </div>
  );
}
