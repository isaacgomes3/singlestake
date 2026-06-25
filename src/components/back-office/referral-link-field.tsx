import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildReferralLinkClient } from "@/lib/referral/build-link";
import { cn } from "@/lib/utils";

type ReferralLinkFieldProps = {
  referralCode?: string | null;
  referralLink?: string | null;
  className?: string;
  inputClassName?: string;
  showCode?: boolean;
  compact?: boolean;
};

export function ReferralLinkField({
  referralCode,
  referralLink,
  className,
  inputClassName,
  showCode = true,
  compact = false,
}: ReferralLinkFieldProps) {
  const [copied, setCopied] = useState(false);
  const code = (referralCode ?? "").trim();
  const link = referralLink?.trim() || (code ? buildReferralLinkClient(code) : "");

  const copy = async () => {
    if (!link) {
      toast.error("Código de indicação indisponível.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado!");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showCode && code ? (
        <p className="text-sm text-text-secondary">
          Código:{" "}
          <span className="font-mono font-semibold text-text-primary">{code}</span>
        </p>
      ) : null}
      {link ? (
        <div className={cn("flex flex-col gap-2", !compact && "sm:flex-row")}>
          <Input
            readOnly
            value={link}
            aria-label="Link de afiliação"
            className={cn("min-w-0 flex-1", inputClassName)}
          />
          <Button
            type="button"
            variant={compact ? "secondary" : "success"}
            onClick={copy}
            className={cn("shrink-0", !compact && "uppercase")}
          >
            <Copy className="h-4 w-4" aria-hidden />
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-text-secondary">A carregar link de indicação…</p>
      )}
    </div>
  );
}
