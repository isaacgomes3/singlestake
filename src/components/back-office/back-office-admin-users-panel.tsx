import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { ReferralLinkField } from "@/components/back-office/referral-link-field";
import { Button } from "@/components/ui/button";
import { copyText, fetchUsersWithReferralLinks } from "@/lib/back-office/admin-api";
import { getSession } from "@/lib/auth/session";
import type { UserReferralRecord } from "@/lib/back-office/admin-types";
import { useI18n } from "@/lib/i18n/i18n-provider";

export function BackOfficeAdminUsersPanel() {
  const { t } = useI18n();
  const isAdmin = getSession()?.user.role === "admin";
  const [users, setUsers] = useState<UserReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void fetchUsersWithReferralLinks().then((rows) => {
      setUsers(rows);
      setLoading(false);
    });
  }, [isAdmin]);

  if (!isAdmin) {
    return <p className="text-sm text-text-secondary">{t("admin.forbidden")}</p>;
  }

  const copyLink = async (link: string) => {
    const ok = await copyText(link);
    toast[ok ? "success" : "error"](
      ok ? t("admin.toastCopied") : t("admin.toastCopyFailed"),
    );
  };

  return (
    <div className="space-y-5">
      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("admin.myLinkTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">{t("admin.myLinkDesc")}</p>
        {getSession()?.user.referralCode ? (
          <div className="mt-4">
            <ReferralLinkField
              referralCode={getSession()!.user.referralCode}
              referralLink={getSession()?.user.referralLink}
            />
          </div>
        ) : null}
      </section>

      <section className="theme-card rounded-2xl p-5">
        <h2 className="text-sm font-bold text-text-primary">{t("admin.allLinksTitle")}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          {loading
            ? t("shared.loading")
            : t("admin.allLinksCount", { count: users.length })}
        </p>

        {loading ? null : users.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">{t("admin.allLinksEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border-color">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-color bg-bg-secondary text-[11px] uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colName")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colEmail")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colCode")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colJoined")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("admin.colLink")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60 last:border-0">
                    <td className="px-3 py-2.5 text-text-primary">
                      {row.name}
                      {row.role === "admin" ? (
                        <span className="ml-1.5 text-[10px] uppercase text-violet-400">admin</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.email}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-primary">
                      {row.referralCode}
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.createdAt}</td>
                    <td className="px-3 py-2.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void copyLink(row.referralLink)}
                      >
                        <Copy className="size-3.5" />
                        {t("admin.copy")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
