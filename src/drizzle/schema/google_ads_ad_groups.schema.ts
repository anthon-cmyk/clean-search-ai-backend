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
import { googleAdsCampaigns } from './google_ads_campaigns.schema';
import { googleAdsKeywords } from './google_ads_keywords.schema';

export const googleAdsAdGroups = pgTable(
  'google_ads_ad_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignDbId: uuid('campaign_db_id')
      .notNull()
      .references(() => googleAdsCampaigns.id, { onDelete: 'cascade' }),

    campaignId: text('campaign_id').notNull(),
    adGroupId: text('ad_group_id').notNull(),
    adGroupName: text('ad_group_name').notNull(),

    status: text('status').notNull(),
    type: text('type'),

    cpcBidMicros: integer('cpc_bid_micros'),
    targetCpaMicros: integer('target_cpa_micros'),

    isActive: boolean('is_active').default(true).notNull(),
    lastFetchedAt: timestamp('last_fetched_at').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    campaignDbIdIdx: index('ad_groups_campaign_db_id_idx').on(
      table.campaignDbId,
    ),
    adGroupIdIdx: index('ad_groups_ad_group_id_idx').on(table.adGroupId),
    statusIdx: index('ad_groups_status_idx').on(table.status),
  }),
);

export const insertGoogleAdsAdGroupSchema =
  createInsertSchema(googleAdsAdGroups);
export const selectGoogleAdsAdGroupSchema =
  createSelectSchema(googleAdsAdGroups);

export type TInsertGoogleAdsAdGroup = typeof googleAdsAdGroups.$inferInsert;
export type TSelectGoogleAdsAdGroup = typeof googleAdsAdGroups.$inferSelect;

export const googleAdsAdGroupsRelations = relations(
  googleAdsAdGroups,
  ({ one, many }) => ({
    campaign: one(googleAdsCampaigns, {
      fields: [googleAdsAdGroups.campaignDbId],
      references: [googleAdsCampaigns.id],
    }),
    keywords: many(googleAdsKeywords),
  }),
);
