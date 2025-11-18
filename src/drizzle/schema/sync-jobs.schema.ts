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
import { googleAdsCustomers } from './google_ads_customers.schema';

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
    adsCustomerId: uuid('ads_customer_id')
      .notNull()
      .references(() => googleAdsCustomers.id, { onDelete: 'cascade' }),

    status: syncJobStatusEnum('status').notNull().default('pending'),

    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),

    recordsProcessed: integer('records_processed').default(0),

    errorMessage: text('error_message'),
    errorDetails: jsonb('error_details'),

    syncStartDate: text('sync_start_date'), // 'YYYY-MM-DD'
    syncEndDate: text('sync_end_date'), // 'YYYY-MM-DD'
    syncType: text('sync_type'), // 'initial', 'incremental', 'backfill'

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    adsCustomerIdIdx: index('sync_jobs_ads_customer_id_idx').on(
      table.adsCustomerId,
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
  adsCustomer: one(googleAdsCustomers, {
    fields: [syncJobs.adsCustomerId],
    references: [googleAdsCustomers.id],
  }),
}));
