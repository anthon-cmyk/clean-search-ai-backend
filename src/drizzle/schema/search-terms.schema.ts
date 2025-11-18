import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { googleAdsAccounts } from './google-ads-accounts.schema';
import { llmProcessingResults } from './llm-processing-results.schema';

export const searchTerms = pgTable(
  'search_terms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    googleAccountId: uuid('google_account_id')
      .notNull()
      .references(() => googleAdsAccounts.id, { onDelete: 'cascade' }),
    // Google Ads IDs are strings
    campaignId: text('campaign_id').notNull(),
    campaignName: text('campaign_name').notNull(),
    adGroupId: text('ad_group_id').notNull(),
    adGroupName: text('ad_group_name').notNull(),
    searchTerm: text('search_term').notNull(),
    keyword: text('keyword').notNull(),
    // Store any additional metrics as JSONB for flexibility
    metrics: jsonb('metrics').$type<{
      impressions?: number;
      clicks?: number;
      cost?: number;
      conversions?: number;
    }>(),
    // When this data was pulled from Google Ads
    fetchedAt: timestamp('fetched_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    googleAccountIdIdx: index('search_terms_google_account_id_idx').on(
      table.googleAccountId,
    ),
    campaignIdIdx: index('search_terms_campaign_id_idx').on(table.campaignId),
    searchTermIdx: index('search_terms_search_term_idx').on(table.searchTerm),
    fetchedAtIdx: index('search_terms_fetched_at_idx').on(table.fetchedAt),
  }),
);

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

export const searchTermsRelations = relations(searchTerms, ({ one, many }) => ({
  googleAccount: one(googleAdsAccounts, {
    fields: [searchTerms.googleAccountId],
    references: [googleAdsAccounts.id],
  }),
  llmResults: many(llmProcessingResults),
}));
