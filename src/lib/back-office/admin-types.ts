export type UserReferralRecord = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  referralCode: string;
  referralLink: string;
  createdAt: string;
};

export type PendingActivationRecord = {
  userId: string;
  userName: string;
  userEmail: string;
  userCreatedAt: string;
  orderId: string | null;
  orderAmount: number | null;
  orderStatus: "pending" | "paid" | "expired" | "cancelled" | null;
  orderCreatedAt: string | null;
};
