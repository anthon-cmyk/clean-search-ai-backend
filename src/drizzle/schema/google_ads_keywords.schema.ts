import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { googleAdsAdGroups } from './google_ads_ad_groups.schema';

export const googleAdsKeywords = pgTable(
  'google_ads_keywords',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adGroupDbId: uuid('ad_group_db_id')
      .notNull()
      .references(() => googleAdsAdGroups.id, { onDelete: 'cascade' }),

    adGroupId: text('ad_group_id').notNull(),
    keywordId: text('keyword_id').notNull(),
    keywordText: text('keyword_text').notNull(),
    matchType: text('match_type').notNull(),

    status: text('status').notNull(),
    finalUrls: text('final_urls').array(),

    cpcBidMicros: integer('cpc_bid_micros'),
    qualityScore: integer('quality_score'),

    isActive: boolean('is_active').default(true).notNull(),
    lastFetchedAt: timestamp('last_fetched_at').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    adGroupDbIdIdx: index('keywords_ad_group_db_id_idx').on(table.adGroupDbId),
    keywordIdIdx: index('keywords_keyword_id_idx').on(table.keywordId),
    keywordTextIdx: index('keywords_keyword_text_idx').on(table.keywordText),
    statusIdx: index('keywords_status_idx').on(table.status),
  }),
);

export const insertGoogleAdsKeywordSchema =
  createInsertSchema(googleAdsKeywords);
export const selectGoogleAdsKeywordSchema =
  createSelectSchema(googleAdsKeywords);

export type TInsertGoogleAdsKeyword = typeof googleAdsKeywords.$inferInsert;
export type TSelectGoogleAdsKeyword = typeof googleAdsKeywords.$inferSelect;

export const googleAdsKeywordsRelations = relations(
  googleAdsKeywords,
  ({ one }) => ({
    adGroup: one(googleAdsAdGroups, {
      fields: [googleAdsKeywords.adGroupDbId],
      references: [googleAdsAdGroups.id],
    }),
  }),
);
