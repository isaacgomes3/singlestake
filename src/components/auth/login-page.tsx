import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetchMe, apiLogin } from "@/lib/auth/api";
import {
  getDevLoginHint,
  goAfterAuth,
  loginRedirectPath,
  setSession,
} from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";

export function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const devHint = getDevLoginHint();

  useEffect(() => {
    void apiFetchMe().then((user) => {
      if (user) {
        setSession(user);
        goAfterAuth(loginRedirectPath());
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await apiLogin(email, password);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      try {
        setSession(result.user);
      } catch {
        toast.error(t("auth.login.sessionSaveFailed"));
        return;
      }

      const verified = await apiFetchMe();
      if (!verified) {
        toast.error(t("auth.login.sessionServerFailed"));
        return;
      }

      toast.success(t("auth.login.welcome", { name: result.user.name }));
      goAfterAuth(loginRedirectPath());
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <>
          {t("auth.login.footerNoAccount")}{" "}
          <Link to="/registar" className="font-semibold text-info hover:underline">
            {t("auth.login.footerCreate")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-text-primary">
            {t("auth.login.email")}
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.login.emailPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-text-primary">
            {t("auth.login.password")}
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
        {devHint ? (
          <p className="text-center text-xs text-text-secondary">
            {t("auth.login.devHint")}{" "}
            <span className="font-mono text-text-primary">{devHint}</span>
          </p>
        ) : null}
      </form>
    </AuthPageShell>
  );
}
