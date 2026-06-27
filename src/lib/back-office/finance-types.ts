import type { WalletBucket } from "@/lib/back-office/finance-constants";

export type DepositRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  method: string;
  status: "pending" | "approved" | "rejected";
  externalRef: string | null;
  createdAt: string;
  processedAt: string | null;
  pixCopyPaste?: string | null;
  qrCodeBase64?: string | null;
};

export type WithdrawalRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  bucket: WalletBucket;
  status: "pending" | "approved" | "rejected" | "paid";
  pixKey: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type WalletRecord = {
  bucket: WalletBucket;
  availableBalance: number;
  blockedBalance: number;
};

export type LedgerEntryRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bucket: WalletBucket;
  entryType: "credit" | "debit";
  amount: number;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};
