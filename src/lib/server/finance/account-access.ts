import { and, eq } from "drizzle-orm";

import { START_PACKAGE_ID } from "@/lib/back-office/product-constants";
import { getDb } from "@/lib/server/db/client";
import { userPackages } from "@/lib/server/db/schema";
import type { SessionUser } from "@/lib/server/auth/http-session";
import { buildReferralLink } from "@/lib/referral/build-link";

export async function userHasActiveStartPack(userId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.userPackages.findFirst({
    where: and(
      eq(userPackages.userId, userId),
      eq(userPackages.packageId, START_PACKAGE_ID),
      eq(userPackages.status, "active"),
    ),
  });
  return !!row;
}

export async function isUserAccountActivated(userId: string, role: string): Promise<boolean> {
  if (role === "admin") return true;
  return userHasActiveStartPack(userId);
}

export async function buildAuthUserPayload(user: SessionUser, origin?: string) {
  const referralCode = user.referralCode ?? "";
  const accountActive = await isUserAccountActivated(user.id, user.role);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    referralCode,
    referralLink: origin && referralCode ? buildReferralLink(referralCode, origin) : undefined,
    accountActive,
  };
}
