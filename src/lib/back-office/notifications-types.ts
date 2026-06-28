export type UserNotificationRecord = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type AdminNotificationRecord = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "user";
  targetUserId: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  createdAt: string;
};
