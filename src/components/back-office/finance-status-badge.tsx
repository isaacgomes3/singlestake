import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  paid: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-200 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  paid: "Pago",
  rejected: "Rejeitado",
};

export function FinanceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        STATUS_STYLES[status] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function formatFinanceDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
