import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { searchTerms } from './search-terms.schema';
import { syncJobs } from './sync-jobs.schema';

export const googleAdsAccounts = pgTable(
  'google_ads_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Links to Supabase auth.users - no FK constraint since it's in different schema
    userId: uuid('user_id').notNull(),
    googleEmail: text('google_email').notNull(),
    googleUserId: text('google_user_id').notNull().unique(),
    // These should be encrypted in production
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    tokenExpiresAt: timestamp('token_expires_at').notNull(),
    scopes: text('scopes').array().notNull(),
    // Google Ads Customer ID (format: 123-456-7890)
    adsCustomerId: text('ads_customer_id'),
    isActive: boolean('is_active').default(true).notNull(),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('google_ads_accounts_user_id_idx').on(table.userId),
    googleUserIdIdx: index('google_ads_accounts_google_user_id_idx').on(
      table.googleUserId,
    ),
    googleEmailIdx: index('google_ads_accounts_google_email_idx').on(
      table.googleEmail,
    ),
  }),
);

const baseInsertSchema = createInsertSchema(googleAdsAccounts);
const baseSelectSchema = createSelectSchema(googleAdsAccounts);

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

export const selectGoogleAccountSchema = baseSelectSchema;
export const updateGoogleAccountSchema = insertGoogleAccountSchema.partial();

export type TInsertGoogleAccount = z.infer<typeof insertGoogleAccountSchema>;
export type TSelectGoogleAccount = z.infer<typeof selectGoogleAccountSchema>;
export type TUpdateGoogleAccount = z.infer<typeof updateGoogleAccountSchema>;

export const googleAdsAccountsRelations = relations(
  googleAdsAccounts,
  ({ many }) => ({
    searchTerms: many(searchTerms),
    syncJobs: many(syncJobs),
  }),
);
