import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { BackOfficeClientList } from "@/components/back-office/back-office-client-list";
import { BackOfficeClientPendingSection } from "@/components/back-office/back-office-client-pending-section";
import { BackOfficeClientProfile } from "@/components/back-office/back-office-client-profile";
import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { Input } from "@/components/ui/input";
import { fetchUsersWithReferralLinks } from "@/lib/back-office/admin-api";
import type { AdminUserRecord } from "@/lib/back-office/admin-types";
import { getSession } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n-provider";

export function BackOfficeClientManagement() {
  const { t } = useI18n();
  const isAdmin = getSession()?.user.role === "admin";

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("cliente");
  });

  useEffect(() => {
    const syncFromUrl = () => {
      setSelectedId(new URLSearchParams(window.location.search).get("cliente"));
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const reload = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchUsersWithReferralLinks();
    setUsers(rows.filter((u) => u.accountStatus !== "deleted"));
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  const openClient = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("cliente", id);
    window.history.pushState({}, "", url);
  };

  const closeClient = () => {
    setSelectedId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("cliente");
    window.history.pushState({}, "", url);
  };

  if (!isAdmin) {
    return <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>;
  }

  if (selectedId) {
    return (
      <BackOfficeClientProfile
        userId={selectedId}
        onBack={closeClient}
        onChanged={() => void reload()}
      />
    );
  }

  const session = getSession();

  return (
    <div className="space-y-5">
      <BackOfficeClientPendingSection onChanged={() => void reload()} />

      <section className="theme-card rounded-2xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-text-primary">{t("admin.clientsListTitle")}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {loading ? t("shared.loading") : t("admin.clientsListCount", { count: filtered.length })}
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("admin.clientsSearchPlaceholder")}
              className="pl-9"
            />
          </div>
        </div>

        <BackOfficeClientList
          users={filtered}
          loading={loading}
          onSelect={openClient}
        />
      </section>

      {session?.user.referralCode ? (
        <section className="theme-card rounded-2xl p-5">
          <h2 className="text-sm font-bold text-text-primary">{t("admin.myLinkTitle")}</h2>
          <div className="mt-4">
            <ReferralLinkField
              referralCode={session.user.referralCode}
              referralLink={session.user.referralLink}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
