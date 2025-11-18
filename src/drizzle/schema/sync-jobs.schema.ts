import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  integer,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { googleAdsAccounts } from './google-ads-accounts.schema';

export const syncJobStatusEnum = pgEnum('sync_job_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);

export type TSyncJobStatus = (typeof syncJobStatusEnum.enumValues)[number];

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    googleAccountId: uuid('google_account_id')
      .notNull()
      .references(() => googleAdsAccounts.id, { onDelete: 'cascade' }),
    status: syncJobStatusEnum('status').notNull().default('pending'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    recordsProcessed: integer('records_processed').default(0),
    errorMessage: text('error_message'),
    errorDetails: jsonb('error_details'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    googleAccountIdIdx: index('sync_jobs_google_account_id_idx').on(
      table.googleAccountId,
    ),
    statusIdx: index('sync_jobs_status_idx').on(table.status),
    createdAtIdx: index('sync_jobs_created_at_idx').on(table.createdAt),
  }),
);

const baseInsertSchema = createInsertSchema(syncJobs);
const baseSelectSchema = createSelectSchema(syncJobs);

export const insertSyncJobSchema = baseInsertSchema;
export const selectSyncJobSchema = baseSelectSchema;
export const updateSyncJobSchema = insertSyncJobSchema.partial();

export type TInsertSyncJob = typeof syncJobs.$inferInsert;
export type TSelectSyncJob = typeof syncJobs.$inferSelect;
export type TUpdateSyncJob = Partial<TInsertSyncJob>;

export const syncJobsRelations = relations(syncJobs, ({ one }) => ({
  googleAccount: one(googleAdsAccounts, {
    fields: [syncJobs.googleAccountId],
    references: [googleAdsAccounts.id],
  }),
}));
