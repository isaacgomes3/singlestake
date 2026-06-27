import { ExternalLink } from "lucide-react";

import { AUTOMATION_DEFAULT_ENTRY, getAutomationPublicOrigin } from "@/lib/app-profile";

export function AutomationEnvironmentCard() {
  const origin = getAutomationPublicOrigin();
  const href = origin ? `${origin}${AUTOMATION_DEFAULT_ENTRY}` : null;

  return (
    <section className="theme-card rounded-2xl border border-border-color p-5">
      <h2 className="text-base font-semibold text-text-primary">Automação (ambiente separado)</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Sala rotativa, simulador global e extensão Chrome correm num subdomínio isolado. Alterações
        na automação não afectam carteiras, pacotes nem dados do back office.
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Abrir automação
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      ) : (
        <p className="mt-4 text-sm text-amber-300">
          Configure <code className="rounded bg-muted px-1">PUBLIC_AUTOMATION_URL</code> ou{" "}
          <code className="rounded bg-muted px-1">VITE_AUTOMATION_PUBLIC_URL</code> no deploy.
        </p>
      )}
    </section>
  );
}
