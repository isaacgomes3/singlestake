import type { Locale } from "@/lib/i18n/types";

const LOCALE_TAG: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

export function formatMoney(locale: Locale, amount: number): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

export function formatDate(locale: Locale, value: number | string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(LOCALE_TAG[locale]);
}

export function formatDateTime(locale: Locale, iso: string): string {
  return new Date(iso).toLocaleString(LOCALE_TAG[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(locale: Locale, ts: number): string {
  return new Date(ts).toLocaleTimeString(LOCALE_TAG[locale], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
