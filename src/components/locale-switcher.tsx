import { Check } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

const FLAG: Record<Locale, string> = {
  pt: "🇧🇷",
  en: "🇺🇸",
  es: "🇪🇸",
};

type Props = {
  compact?: boolean;
  className?: string;
};

export function LocaleSwitcher({ compact, className }: Props) {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-border-color bg-bg-secondary text-text-primary transition-colors hover:bg-bg-card-hover",
          compact ? "size-9 text-base" : "gap-2 px-3 py-2 text-sm font-medium",
          className,
        )}
        aria-label={t("layout.selectLanguage")}
      >
        <span aria-hidden>{FLAG[locale]}</span>
        {!compact ? <span>{LOCALE_LABELS[locale]}</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("layout.selectLanguage")}
        </DropdownMenuLabel>
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLocale(code)}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden>{FLAG[code]}</span>
              {LOCALE_LABELS[code]}
            </span>
            {locale === code ? <Check className="size-4 text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
