import { LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { StartPackPaymentBanner } from "@/components/auth/start-pack-payment-banner";
import { Button } from "@/components/ui/button";
import { apiFetchActivation, apiFetchMe, apiLogout } from "@/lib/auth/api";
import {
  clearSession,
  goAfterAuth,
  setSession,
} from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";

export function AccountActivationPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [pixError, setPixError] = useState<string | null>(null);
  const [order, setOrder] = useState<Awaited<ReturnType<typeof apiFetchActivation>>["order"]>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const user = await apiFetchMe();
    if (!user) {
      window.location.replace("/entrar");
      return;
    }
    setSession(user);

    if (user.accountActive) {
      goAfterAuth("/back-office");
      return;
    }

    const activation = await apiFetchActivation();
    if (!activation.ok) {
      setPixError(activation.error ?? t("auth.activation.loadError"));
      setLoading(false);
      return;
    }

    if (activation.accountActive) {
      const refreshed = await apiFetchMe();
      if (refreshed) setSession(refreshed);
      goAfterAuth("/back-office");
      return;
    }

    if (activation.pixError) setPixError(activation.pixError);
    else setPixError(null);
    setOrder(activation.order ?? null);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePaid = async () => {
    const user = await apiFetchMe();
    if (user) {
      setSession(user);
      if (user.accountActive) {
        toast.success(t("auth.activation.accessUnlocked"));
        goAfterAuth("/back-office");
      }
    }
  };

  const handleLogout = async () => {
    await apiLogout();
    clearSession();
    window.location.replace("/entrar");
  };

  const refreshPix = async () => {
    setLoading(true);
    const res = await fetch("/api/auth/activation", {
      method: "POST",
      credentials: "include",
    });
    const data = (await res.json()) as { ok: boolean; order?: typeof order; error?: string };
    if (!data.ok || !data.order) {
      toast.error(data.error ?? t("auth.activation.pixGenerateError"));
      setLoading(false);
      return;
    }
    setOrder(data.order);
    setPixError(null);
    setLoading(false);
  };

  return (
    <AuthPageShell
      title={t("auth.activation.title")}
      subtitle={t("auth.activation.subtitle")}
      footer={
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => void handleLogout()}>
          <LogOut className="h-4 w-4" aria-hidden />
          {t("auth.activation.logout")}
        </Button>
      }
    >
      {loading ? (
        <p className="py-12 text-center text-sm text-text-secondary">{t("shared.loading")}</p>
      ) : pixError && !order ? (
        <div className="space-y-4 rounded-2xl border border-danger/40 bg-danger/10 p-5 text-center">
          <p className="text-sm text-danger">{pixError}</p>
          <Button type="button" onClick={() => void refreshPix()}>
            {t("auth.activation.retryPix")}
          </Button>
        </div>
      ) : order ? (
        <StartPackPaymentBanner
          order={order}
          packageName={t("auth.activation.packName")}
          onPaid={() => void handlePaid()}
        />
      ) : null}

      {!loading && order ? (
        <p className="mt-4 text-center text-xs text-text-secondary">{t("auth.activation.afterPayHint")}</p>
      ) : null}
    </AuthPageShell>
  );
}
