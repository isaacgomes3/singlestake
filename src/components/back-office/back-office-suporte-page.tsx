import { Headphones, Mail, MessageCircle } from "lucide-react";

export function BackOfficeSuportePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">Suporte</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary sm:text-3xl">Central de ajuda</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Canal de ajuda para afiliados e operadores — chat, FAQ e tickets.
        </p>
      </div>

      <div className="theme-card px-6 py-12 text-center sm:py-16">
        <Headphones className="mx-auto h-12 w-12 text-info" aria-hidden />
        <p className="mt-4 text-lg font-semibold text-text-primary">Suporte</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
          Em integração. Aqui poderás ligar chat ao vivo, FAQ ou o teu sistema de tickets.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="mailto:suporte@exemplo.com"
            className="inline-flex items-center gap-2 rounded-lg border border-border-color bg-bg-secondary px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-bg-card-hover"
          >
            <Mail className="h-4 w-4" aria-hidden />
            suporte@exemplo.com
          </a>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground opacity-60"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Chat ao vivo (em breve)
          </button>
        </div>
      </div>
    </div>
  );
}
