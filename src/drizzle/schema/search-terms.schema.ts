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
import { googleAdsCustomers } from './google_ads_customers.schema';
import { llmProcessingResults } from './llm-processing-results.schema';

export const searchTerms = pgTable(
  'search_terms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Changed from googleAccountId to adsCustomerId
    adsCustomerId: uuid('ads_customer_id')
      .notNull()
      .references(() => googleAdsCustomers.id, { onDelete: 'cascade' }),

    campaignId: text('campaign_id').notNull(),
    campaignName: text('campaign_name').notNull(),
    adGroupId: text('ad_group_id').notNull(),
    adGroupName: text('ad_group_name').notNull(),
    searchTerm: text('search_term').notNull(),
    // keyword: text('keyword').notNull(),

    metrics: jsonb('metrics').$type<{
      impressions?: number;
      clicks?: number;
      cost?: number;
      conversions?: number;
    }>(),

    fetchedAt: timestamp('fetched_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    adsCustomerIdIdx: index('search_terms_ads_customer_id_idx').on(
      table.adsCustomerId,
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
  // keyword: z.string().min(1),
});

export const selectSearchTermSchema = baseSelectSearchTermSchema;

export type TInsertSearchTerm = z.infer<typeof insertSearchTermSchema>;
export type TSelectSearchTerm = z.infer<typeof selectSearchTermSchema>;

export const searchTermsRelations = relations(searchTerms, ({ one, many }) => ({
  adsCustomer: one(googleAdsCustomers, {
    fields: [searchTerms.adsCustomerId],
    references: [googleAdsCustomers.id],
  }),
  llmResults: many(llmProcessingResults),
}));
