export type UserReferralRecord = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  referralCode: string;
  referralLink: string;
  createdAt: string;
};

export type AdminUserRecord = UserReferralRecord & {
  accountStatus: "active" | "blocked" | "deleted";
  accountActive: boolean;
  automationActive: boolean;
  pixKeyMasked: string | null;
  pixKeyLocked: boolean;
  allowPixKeyEdit: boolean;
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

export type PixKeyProfileDto = {
  pixKey: string | null;
  pixKeySetAt: string | null;
  locked: boolean;
  allowEdit: boolean;
  canEdit: boolean;
};
