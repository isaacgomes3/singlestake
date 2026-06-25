export type UserReferralRecord = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  referralCode: string;
  referralLink: string;
  createdAt: string;
};
