import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRegister } from "@/lib/auth/api";
import { goAfterAuth, postAuthRedirectPath, setSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";

export function RegisterPage({ initialReferralCode }: { initialReferralCode?: string }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferralCode ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t("auth.register.passwordMismatch"));
      return;
    }
    setLoading(true);
    const result = await apiRegister({
      name,
      email,
      password,
      referralCode: referralCode.trim() || undefined,
    });
    if (!result.ok) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    try {
      setSession(result.user);
    } catch {
      toast.error(t("auth.register.sessionSaveFailed"));
      setLoading(false);
      return;
    }
    toast.success(t("auth.register.successPending"));
    goAfterAuth(postAuthRedirectPath(result.user));
  };

  return (
    <AuthPageShell
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      footer={
        <>
          {t("auth.register.footerHasAccount")}{" "}
          <Link to="/entrar" className="font-semibold text-info hover:underline">
            {t("auth.register.footerLogin")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-text-primary">
            {t("auth.register.name")}
          </label>
          <Input
            id="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.register.namePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="reg-email" className="text-sm font-medium text-text-primary">
            {t("auth.register.email")}
          </label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.register.emailPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="reg-password" className="text-sm font-medium text-text-primary">
            {t("auth.register.password")}
          </label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.register.passwordPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm" className="text-sm font-medium text-text-primary">
            {t("auth.register.confirm")}
          </label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("auth.register.confirmPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="referral" className="text-sm font-medium text-text-primary">
            {t("auth.register.referral")}
          </label>
          <Input
            id="referral"
            autoComplete="off"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder={t("auth.register.referralPlaceholder")}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>
      </form>
    </AuthPageShell>
  );
}
