import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** Utilizadores do sistema (auth + back-office). */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["user", "admin"] })
      .notNull()
      .default("user"),
    referralCode: text("referral_code").notNull(),
    sponsorId: text("sponsor_id"),
    /** Conta principal quando este registo é sub-conta para qualificação binária. */
    masterUserId: text("master_user_id"),
    qualification: text("qualification", {
      enum: ["bronze", "prata", "ouro", "diamante", "imperial"],
    })
      .notNull()
      .default("bronze"),
    /** CPF do titular (11 dígitos) — obrigatório para PIX via Luc Paguei. */
    cpf: text("cpf"),
    /** active | blocked | deleted (soft delete). */
    accountStatus: text("account_status", { enum: ["active", "blocked", "deleted"] })
      .notNull()
      .default("active"),
    /** Chave PIX para saques — bloqueada após 1.º registo até permissão admin. */
    pixKey: text("pix_key"),
    pixKeySetAt: integer("pix_key_set_at", { mode: "timestamp_ms" }),
    /** Admin libera alteração da chave PIX pelo utilizador. */
    allowPixKeyEdit: integer("allow_pix_key_edit", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("users_email_uidx").on(t.email),
    uniqueIndex("users_referral_code_uidx").on(t.referralCode),
    index("users_sponsor_id_idx").on(t.sponsorId),
    index("users_master_user_id_idx").on(t.masterUserId),
  ],
);

/** Sessões HTTP (cookie) — substitui localStorage no servidor. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId), index("sessions_expires_at_idx").on(t.expiresAt)],
);

/** Carteiras por bucket (rendimentos, afiliados, binário, etc.). */
export const walletAccounts = sqliteTable(
  "wallet_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bucket: text("bucket", {
      enum: [
        "rendimentos",
        "afiliados",
        "automacao",
        "empresa",
        "binario",
        "residual",
        "operacoes",
      ],
    }).notNull(),
    availableBalance: real("available_balance").notNull().default(0),
    blockedBalance: real("blocked_balance").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("wallet_accounts_user_bucket_uidx").on(t.userId, t.bucket)],
);

/** Extrato financeiro / movimentos. */
export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bucket: text("bucket", {
      enum: [
        "rendimentos",
        "afiliados",
        "automacao",
        "empresa",
        "binario",
        "residual",
        "operacoes",
      ],
    }).notNull(),
    entryType: text("entry_type", { enum: ["credit", "debit"] }).notNull(),
    amount: real("amount").notNull(),
    description: text("description").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("ledger_entries_user_id_idx").on(t.userId),
    index("ledger_entries_created_at_idx").on(t.createdAt),
  ],
);

/** Pacotes de investimento (Start, Bronze, Prata, Ouro). */
export const investmentPackages = sqliteTable("investment_packages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  minAmount: real("min_amount").notNull(),
  maxAmount: real("max_amount").notNull(),
  dailyYieldPct: real("daily_yield_pct").notNull().default(0),
  termDays: integer("term_days").notNull().default(365),
  packageKind: text("package_kind", { enum: ["start", "automation"] })
    .notNull()
    .default("automation"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Pacote activo de cada utilizador. */
export const userPackages = sqliteTable(
  "user_packages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    packageId: text("package_id")
      .notNull()
      .references(() => investmentPackages.id),
    amount: real("amount").notNull(),
    affiliateAmount: real("affiliate_amount").notNull().default(0),
    automationBase: real("automation_base").notNull().default(0),
    companyAmount: real("company_amount").notNull().default(0),
    totalEarned: real("total_earned").notNull().default(0),
    maxProfit: real("max_profit").notNull().default(0),
    status: text("status", { enum: ["active", "inactive", "expired"] })
      .notNull()
      .default("active"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    termEndsAt: integer("term_ends_at", { mode: "timestamp_ms" }).notNull(),
    adhesionEndsAt: integer("adhesion_ends_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("user_packages_user_id_idx").on(t.userId)],
);

/** Mensalidade / subscrição. */
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["grace", "active", "pending", "expired"] })
      .notNull()
      .default("grace"),
    amount: real("amount"),
    graceEndsAt: integer("grace_ends_at", { mode: "timestamp_ms" }),
    renewsAt: integer("renews_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("subscriptions_user_id_uidx").on(t.userId)],
);

/** Créditos perdidos por mensalidade vencida (não acumulam). */
export const missedCredits = sqliteTable(
  "missed_credits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    reason: text("reason").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("missed_credits_user_id_idx").on(t.userId)],
);

/** Nó na árvore binária (MMN). */
export const binaryTreeNodes = sqliteTable(
  "binary_tree_nodes",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references(() => users.id),
    side: text("side", { enum: ["left", "right"] }),
    placedAt: integer("placed_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("binary_tree_nodes_parent_id_idx").on(t.parentId)],
);

/** Pontos binários por nível e perna (1 ponto = R$ 1). */
export const binaryLegPoints = sqliteTable(
  "binary_leg_points",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    side: text("side", { enum: ["left", "right"] }).notNull(),
    totalPoints: real("total_points").notNull().default(0),
    matchedPoints: real("matched_points").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("binary_leg_points_user_level_side_uidx").on(t.userId, t.level, t.side),
    index("binary_leg_points_user_id_idx").on(t.userId),
  ],
);

/** Pedidos de depósito. */
export const deposits = sqliteTable(
  "deposits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    method: text("method").notNull().default("pix"),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    externalRef: text("external_ref"),
    pixCopyPaste: text("pix_copy_paste"),
    qrCodeBase64: text("qr_code_base64"),
    gatewayTransactionId: text("gateway_transaction_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("deposits_user_id_idx").on(t.userId)],
);

/** Cobrança PIX pendente para compra de pacote (Efi Pay). */
export const packagePixOrders = sqliteTable(
  "package_pix_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    packageId: text("package_id").notNull(),
    amount: real("amount").notNull(),
    status: text("status", { enum: ["pending", "paid", "expired", "cancelled"] })
      .notNull()
      .default("pending"),
    txid: text("txid").notNull().unique(),
    gatewayTransactionId: text("gateway_transaction_id"),
    pixCopyPaste: text("pix_copy_paste"),
    qrCodeBase64: text("qr_code_base64"),
    userPackageId: text("user_package_id"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("package_pix_orders_user_id_idx").on(t.userId),
    index("package_pix_orders_txid_idx").on(t.txid),
    index("package_pix_orders_gateway_tx_idx").on(t.gatewayTransactionId),
  ],
);

/** Pedidos de saque. */
export const withdrawals = sqliteTable(
  "withdrawals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    bucket: text("bucket", {
      enum: [
        "rendimentos",
        "afiliados",
        "automacao",
        "empresa",
        "binario",
        "residual",
        "operacoes",
      ],
    }).notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected", "paid"] })
      .notNull()
      .default("pending"),
    pixKey: text("pix_key"),
    externalRef: text("external_ref"),
    gatewayTransactionId: text("gateway_transaction_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("withdrawals_user_id_idx").on(t.userId)],
);

/** Auditoria de acções admin. */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    detail: text("detail"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("audit_logs_created_at_idx").on(t.createdAt)],
);

/** Configurações globais (JSON) — níveis de bónus, caps, etc. */
export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Notificações enviadas pelo admin (utilizador específico ou em massa). */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    audience: text("audience", { enum: ["all", "user"] }).notNull(),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("notifications_target_user_id_idx").on(t.targetUserId),
    index("notifications_created_at_idx").on(t.createdAt),
  ],
);

/** Leitura de notificações por utilizador. */
export const notificationReads = sqliteTable(
  "notification_reads",
  {
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: integer("read_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("notification_reads_uidx").on(t.notificationId, t.userId),
    index("notification_reads_user_id_idx").on(t.userId),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  sponsor: one(users, { fields: [users.sponsorId], references: [users.id] }),
  sessions: many(sessions),
  wallets: many(walletAccounts),
  ledgerEntries: many(ledgerEntries),
  packages: many(userPackages),
  subscription: one(subscriptions),
  binaryNode: one(binaryTreeNodes),
  deposits: many(deposits),
  packagePixOrders: many(packagePixOrders),
  withdrawals: many(withdrawals),
  notificationsCreated: many(notifications, { relationName: "notificationCreator" }),
  notificationReads: many(notificationReads),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const depositsRelations = relations(deposits, ({ one }) => ({
  user: one(users, { fields: [deposits.userId], references: [users.id] }),
}));

export const packagePixOrdersRelations = relations(packagePixOrders, ({ one }) => ({
  user: one(users, { fields: [packagePixOrders.userId], references: [users.id] }),
}));

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  user: one(users, { fields: [withdrawals.userId], references: [users.id] }),
}));

export const walletAccountsRelations = relations(walletAccounts, ({ one }) => ({
  user: one(users, { fields: [walletAccounts.userId], references: [users.id] }),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  user: one(users, { fields: [ledgerEntries.userId], references: [users.id] }),
}));

export const userPackagesRelations = relations(userPackages, ({ one }) => ({
  user: one(users, { fields: [userPackages.userId], references: [users.id] }),
  pkg: one(investmentPackages, {
    fields: [userPackages.packageId],
    references: [investmentPackages.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  targetUser: one(users, {
    fields: [notifications.targetUserId],
    references: [users.id],
    relationName: "notificationTarget",
  }),
  createdBy: one(users, {
    fields: [notifications.createdByUserId],
    references: [users.id],
    relationName: "notificationCreator",
  }),
  reads: many(notificationReads),
}));

export const notificationReadsRelations = relations(notificationReads, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationReads.notificationId],
    references: [notifications.id],
  }),
  user: one(users, { fields: [notificationReads.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type WalletAccount = typeof walletAccounts.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type InvestmentPackageRow = typeof investmentPackages.$inferSelect;
