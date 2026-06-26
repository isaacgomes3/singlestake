import { formatDate, formatDateTime, formatMoney, formatTime } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/i18n-provider";

export function useFormat() {
  const { locale } = useI18n();
  return {
    money: (amount: number) => formatMoney(locale, amount),
    date: (value: number | string | Date) => formatDate(locale, value),
    dateTime: (iso: string) => formatDateTime(locale, iso),
    time: (ts: number) => formatTime(locale, ts),
  };
}
