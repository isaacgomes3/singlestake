import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRegister } from "@/lib/auth/api";
import { goAfterAuth, setSession } from "@/lib/auth/session";

export function RegisterPage({ initialReferralCode }: { initialReferralCode?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferralCode ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
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
      toast.error("Não foi possível guardar a sessão neste browser.");
      setLoading(false);
      return;
    }
    toast.success("Conta criada com sucesso!");
    goAfterAuth("/back-office");
  };

  return (
    <AuthPageShell
      title="Criar conta"
      subtitle="Cadastre-se para aceder ao back office singlestake."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/entrar" className="font-semibold text-info hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-text-primary">
            Nome completo
          </label>
          <Input
            id="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="O seu nome"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="reg-email" className="text-sm font-medium text-text-primary">
            E-mail
          </label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="reg-password" className="text-sm font-medium text-text-primary">
            Senha
          </label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm" className="text-sm font-medium text-text-primary">
            Confirmar senha
          </label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="referral" className="text-sm font-medium text-text-primary">
            Código de indicação (opcional)
          </label>
          <Input
            id="referral"
            autoComplete="off"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "A criar conta…" : "Criar conta"}
        </Button>
      </form>
    </AuthPageShell>
  );
}
