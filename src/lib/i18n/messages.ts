import { en } from "@/lib/i18n/locales/en";
import { es } from "@/lib/i18n/locales/es";
import { pt } from "@/lib/i18n/locales/pt";
import type { Locale, Messages } from "@/lib/i18n/types";

export const MESSAGES: Record<Locale, Messages> = {
  pt,
  en,
  es,
};

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export function navGroupLabel(messages: Messages, groupId: string): string {
  return messages.nav.groups[groupId] ?? groupId;
}

export function navModuleLabel(messages: Messages, moduleId: string): string {
  return messages.nav.modules[moduleId] ?? moduleId;
}

export function navSectionLabel(messages: Messages, sectionKey: string): string {
  return messages.nav.sections[sectionKey] ?? sectionKey;
}

export function navGroupDescription(messages: Messages, groupId: string): string {
  return messages.nav.descriptions.groups[groupId] ?? groupId;
}

export function navModuleDescription(messages: Messages, moduleId: string): string {
  return messages.nav.descriptions.modules[moduleId] ?? moduleId;
}
