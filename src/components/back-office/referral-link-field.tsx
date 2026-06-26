import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/i18n-provider";
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
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const code = (referralCode ?? "").trim();
  const link = referralLink?.trim() || (code ? buildReferralLinkClient(code) : "");

  const copy = async () => {
    if (!link) {
      toast.error(t("finance.referral.unavailable"));
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t("finance.referral.copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("finance.referral.copyFailed"));
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showCode && code ? (
        <p className="text-sm text-text-secondary">
          {t("finance.referral.code")}{" "}
          <span className="font-mono font-semibold text-text-primary">{code}</span>
        </p>
      ) : null}
      {link ? (
        <div className={cn("flex flex-col gap-2", !compact && "sm:flex-row")}>
          <Input
            readOnly
            value={link}
            aria-label={t("finance.referral.ariaLink")}
            className={cn("min-w-0 flex-1", inputClassName)}
          />
          <Button
            type="button"
            variant={compact ? "secondary" : "success"}
            onClick={copy}
            className={cn("shrink-0", !compact && "uppercase")}
          >
            <Copy className="h-4 w-4" aria-hidden />
            {copied ? t("shared.copied") : t("shared.copy")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-text-secondary">{t("finance.referral.loading")}</p>
      )}
    </div>
  );
}
