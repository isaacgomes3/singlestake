/** Link de registo com código de indicação do patrocinador. */
export function buildReferralLink(referralCode: string | null | undefined, origin: string): string {
  const code = (referralCode ?? "").trim().toUpperCase();
  if (!code) return "";
  const base = origin.replace(/\/$/, "");
  return `${base}/registar?ref=${encodeURIComponent(code)}`;
}

/** No browser, monta o link a partir do código quando a API não enviou origin. */
export function buildReferralLinkClient(referralCode: string | null | undefined): string {
  if (typeof window === "undefined") return "";
  return buildReferralLink(referralCode, window.location.origin);
}
