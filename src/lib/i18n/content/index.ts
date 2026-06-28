import type { Locale } from "@/lib/i18n/types";
import { authContent } from "@/lib/i18n/content/auth";
import { adminContent, casinoContent, demoContent } from "@/lib/i18n/content/casino";
import { financeContent } from "@/lib/i18n/content/finance";
import { networkContent } from "@/lib/i18n/content/network";
import { overviewContent } from "@/lib/i18n/content/overview";
import { productsContent } from "@/lib/i18n/content/products";
import { sharedContent } from "@/lib/i18n/content/shared";
import { automationStatsContent } from "@/lib/i18n/content/automation-stats";
import { supportContent } from "@/lib/i18n/content/support";

export function buildPanelMessages(locale: Locale) {
  return {
    shared: sharedContent[locale],
    auth: authContent[locale],
    overview: overviewContent[locale],
    finance: financeContent[locale],
    support: supportContent[locale],
    products: productsContent[locale],
    network: networkContent[locale],
    casino: casinoContent[locale],
    demo: demoContent[locale],
    admin: adminContent[locale],
    automationStats: automationStatsContent[locale],
  };
}

export type PanelMessages = ReturnType<typeof buildPanelMessages>;
