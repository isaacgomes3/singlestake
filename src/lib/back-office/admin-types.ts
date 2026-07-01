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

export type PendingAutomationPixRecord = {
  orderId: string;
  userId: string;
  userName: string;
  userEmail: string;
  packageId: string;
  packageName: string;
  amount: number;
  orderCreatedAt: string;
};

export type UserQualification = "bronze" | "prata" | "ouro" | "diamante" | "imperial";

export type AdminUserDetail = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  cpf: string | null;
  referralCode: string;
  referralLink: string;
  qualification: UserQualification;
  accountStatus: "active" | "blocked" | "deleted";
  accountActive: boolean;
  automationActive: boolean;
  pixKey: string | null;
  pixKeyMasked: string | null;
  pixKeySetAt: string | null;
  allowPixKeyEdit: boolean;
  pixKeyLocked: boolean;
  createdAt: string;
  updatedAt: string;
  sponsor: { id: string; name: string; email: string } | null;
  subscription: {
    status: "grace" | "active" | "pending" | "expired";
    amount: number | null;
    graceEndsAt: string | null;
    renewsAt: string | null;
  } | null;
  packages: {
    id: string;
    packageId: string;
    packageName: string;
    packageKind: string;
    amount: number;
    automationBase: number | null;
    totalEarned: number;
    maxProfit: number | null;
    status: string;
    startedAt: string;
    termEndsAt: string;
  }[];
  wallets: {
    bucket: string;
    availableBalance: number;
    blockedBalance: number;
  }[];
  automationDepositedTotal: number;
  automationBalance: number;
  ledger: {
    id: string;
    bucket: string;
    entryType: string;
    amount: number;
    description: string | null;
    createdAt: string;
  }[];
  deposits: {
    id: string;
    amount: number;
    method: string;
    status: string;
    createdAt: string;
  }[];
  withdrawals: {
    id: string;
    amount: number;
    bucket: string;
    status: string;
    createdAt: string;
  }[];
  pixOrders: {
    id: string;
    packageId: string;
    packageName: string;
    amount: number;
    status: string;
    hasQrCode: boolean;
    createdAt: string;
    paidAt: string | null;
  }[];
};

export type PixKeyProfileDto = {
  pixKey: string | null;
  pixKeySetAt: string | null;
  locked: boolean;
  allowEdit: boolean;
  canEdit: boolean;
};
