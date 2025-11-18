import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const searchTerms = pgTable('search_terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  googleAccountId: uuid('google_account_id')
    .notNull()
    .references(() => googleAdsAccounts.id, { onDelete: 'cascade' }),
  campaignId: text('campaign_id').notNull(),
  campaignName: text('campaign_name').notNull(),
  adGroupId: text('ad_group_id').notNull(),
  adGroupName: text('ad_group_name').notNull(),
  searchTerm: text('search_term').notNull(),
  keyword: text('keyword').notNull(),
  metrics: jsonb('metrics'),
  fetchedAt: timestamp('fetched_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const baseInsertSearchTermSchema = createInsertSchema(searchTerms);
const baseSelectSearchTermSchema = createSelectSchema(searchTerms);

export const insertSearchTermSchema = baseInsertSearchTermSchema.extend({
  campaignId: z.string().min(1),
  campaignName: z.string().min(1),
  adGroupId: z.string().min(1),
  adGroupName: z.string().min(1),
  searchTerm: z.string().min(1),
  keyword: z.string().min(1),
});

export const selectSearchTermSchema = baseSelectSearchTermSchema;

export type TInsertSearchTerm = z.infer<typeof insertSearchTermSchema>;
export type TSelectSearchTerm = z.infer<typeof selectSearchTermSchema>;

export const googleAdsAccounts = pgTable(
  'google_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    googleEmail: text('google_email').notNull(),
    googleUserId: text('google_user_id').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    tokenExpiresAt: timestamp('token_expires_at').notNull(),
    scopes: text('scopes').array().notNull(),
    adsCustomerId: text('ads_customer_id'),
    isActive: boolean('is_active').default(true).notNull(),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('google_accounts_user_id_idx').on(table.userId),
    googleUserIdIdx: index('google_accounts_google_user_id_idx').on(
      table.googleUserId,
    ),
  }),
);

// Auto-generated base schemas
const baseInsertSchema = createInsertSchema(googleAdsAccounts);
const baseSelectSchema = createSelectSchema(googleAdsAccounts);

// Extended insert schema with runtime validation
export const insertGoogleAccountSchema = baseInsertSchema.extend({
  googleEmail: z.string().email('Invalid email format'),
  googleUserId: z.string().min(1, 'Google user ID required'),
  accessToken: z.string().min(1, 'Access token required'),
  refreshToken: z.string().min(1, 'Refresh token required'),
  scopes: z.array(z.string()).min(1, 'At least one scope required'),
  tokenExpiresAt: z.date().refine((date) => date > new Date(), {
    message: 'Token expiry must be in the future',
  }),
});

// Extended select schema (if you need additional runtime checks)
export const selectGoogleAccountSchema = baseSelectSchema;

// Update schema for PATCH operations
export const updateGoogleAccountSchema = insertGoogleAccountSchema.partial();

// Inferred types - THIS IS THE KEY PART I MISSED
export type TInsertGoogleAccount = z.infer<typeof insertGoogleAccountSchema>;
export type TSelectGoogleAccount = z.infer<typeof selectGoogleAccountSchema>;
export type TUpdateGoogleAccount = z.infer<typeof updateGoogleAccountSchema>;

// Relations
export const googleAdsAccountsRelations = relations(
  googleAdsAccounts,
  ({ many }) => ({
    searchTerms: many(searchTerms),
  }),
);
