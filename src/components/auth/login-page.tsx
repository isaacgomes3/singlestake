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

export function LoginPage() {
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
        toast.error("Não foi possível guardar a sessão neste browser.");
        return;
      }
      toast.success(`Bem-vindo, ${result.user.name}!`);
      goAfterAuth(loginRedirectPath());
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="Entrar"
      subtitle="Aceda ao painel singlestake — rede, financeiro e casino ao vivo."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/registar" className="font-semibold text-info hover:underline">
            Criar cadastro
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-text-primary">
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-text-primary">
            Senha
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
          {loading ? "A entrar…" : "Entrar no painel"}
        </Button>
        {devHint ? (
          <p className="text-center text-xs text-text-secondary">
            Dev: <span className="font-mono text-text-primary">{devHint}</span>
          </p>
        ) : null}
      </form>
    </AuthPageShell>
  );
}
