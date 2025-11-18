import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { googleAdsAccounts } from './google-ads-accounts.schema';

export const syncJobStatusEnum = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
]);

export type TSyncJobStatus = z.infer<typeof syncJobStatusEnum>;

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    googleAccountId: uuid('google_account_id')
      .notNull()
      .references(() => googleAdsAccounts.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
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

export const insertSyncJobSchema = baseInsertSchema.extend({
  status: syncJobStatusEnum,
});

export const selectSyncJobSchema = baseSelectSchema;
export const updateSyncJobSchema = insertSyncJobSchema.partial();

export type TInsertSyncJob = z.infer<typeof insertSyncJobSchema>;
export type TSelectSyncJob = z.infer<typeof selectSyncJobSchema>;
export type TUpdateSyncJob = z.infer<typeof updateSyncJobSchema>;

export const syncJobsRelations = relations(syncJobs, ({ one }) => ({
  googleAccount: one(googleAdsAccounts, {
    fields: [syncJobs.googleAccountId],
    references: [googleAdsAccounts.id],
  }),
}));
