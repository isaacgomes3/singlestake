import { useNavigate } from "@tanstack/react-router";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { navGroupLabel, navModuleLabel } from "@/lib/i18n/messages";
import { BACK_OFFICE_NAV, BACK_OFFICE_GROUPS } from "@/lib/back-office/navigation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BackOfficeSearchCommand({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { messages, t } = useI18n();

  const modules = BACK_OFFICE_NAV.filter((item) => item.id !== "visao-geral");

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("layout.search")} />
      <CommandList>
        <CommandEmpty>{t("casino.searchNoResults")}</CommandEmpty>
        <CommandGroup heading={t("nav.overview")}>
          <CommandItem
            onSelect={() => {
              void navigate({ to: "/back-office" });
              onOpenChange(false);
            }}
          >
            {t("nav.overview")}
          </CommandItem>
        </CommandGroup>
        {BACK_OFFICE_GROUPS.map((group) => (
          <CommandGroup key={group.id} heading={navGroupLabel(messages, group.id)}>
            {group.moduleIds.map((moduleId) => {
              const mod = modules.find((m) => m.id === moduleId);
              if (!mod) return null;
              return (
                <CommandItem
                  key={mod.id}
                  onSelect={() => {
                    void navigate({ to: mod.path });
                    onOpenChange(false);
                  }}
                >
                  {navModuleLabel(messages, mod.id)}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandGroup heading={t("nav.suporte")}>
          <CommandItem
            onSelect={() => {
              void navigate({ to: "/back-office/suporte" });
              onOpenChange(false);
            }}
          >
            {t("nav.suporte")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
