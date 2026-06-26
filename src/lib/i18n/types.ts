import type { PanelMessages } from "@/lib/i18n/content";
import type { navDescriptionsContent } from "@/lib/i18n/content/nav-descriptions";

export const LOCALES = ["pt", "en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt";

export const LOCALE_LABELS: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

export const LOCALE_HTML_LANG: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
  es: "es",
};

type NavDescriptions = (typeof navDescriptionsContent)["pt"];

export type Messages = PanelMessages & {
  common: {
    loading: string;
    logout: string;
    login: string;
    close: string;
    openMenu: string;
    closeMenu: string;
    goToLogin: string;
    sessionExpired: string;
    redirectingLogin: string;
    markAllRead: string;
    viewAll: string;
    affiliateLink: string;
    backOffice: string;
  };
  layout: {
    search: string;
    searchShortcut: string;
    notifications: string;
    messages: string;
    support: string;
    affiliate: string;
    selectLanguage: string;
    welcomeBack: string;
    yourStore: string;
    affiliateProgram: string;
    documentation: string;
    settings: string;
    roleAdmin: string;
    roleUser: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    layoutMenu: string;
    boxedMenu: string;
    edgeMenu: string;
    boxedMenuDesc: string;
    edgeMenuDesc: string;
  };
  nav: {
    overview: string;
    suporte: string;
    groups: Record<string, string>;
    modules: Record<string, string>;
    sections: Record<string, string>;
    descriptions: NavDescriptions;
  };
  notifications: {
    title1: string;
    body1: string;
    title2: string;
    body2: string;
    title3: string;
    body3: string;
    ago: string;
  };
  utility: {
    affiliateTitle: string;
    affiliateDesc: string;
    supportTitle: string;
    supportDesc: string;
    messagesTitle: string;
    messagesEmpty: string;
  };
};
