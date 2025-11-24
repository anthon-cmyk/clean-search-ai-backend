import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  integer,
  boolean,
  numeric,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { googleAdsCustomers } from './google_ads_customers.schema';
import { googleAdsAdGroups } from './google_ads_ad_groups.schema';

export const googleAdsCampaigns = pgTable(
  'google_ads_campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adsCustomerId: uuid('ads_customer_id')
      .notNull()
      .references(() => googleAdsCustomers.id, { onDelete: 'cascade' }),

    campaignId: text('campaign_id').notNull(),
    campaignName: text('campaign_name').notNull(),

    status: text('status').notNull(),
    biddingStrategyType: text('bidding_strategy_type'),
    advertisingChannelType: text('advertising_channel_type'),

    budgetAmountMicros: integer('budget_amount_micros'),
    currencyCode: text('currency_code'),

    startDate: text('start_date'),
    endDate: text('end_date'),

    impressions: integer('impressions').default(0),
    clicks: integer('clicks').default(0),
    cost: numeric('cost', { precision: 12, scale: 2 }).default('0'),
    conversions: numeric('conversions', { precision: 10, scale: 2 }).default(
      '0',
    ),
    conversionsValue: numeric('conversions_value', {
      precision: 12,
      scale: 2,
    }).default('0'),
    ctr: numeric('ctr', { precision: 5, scale: 4 }).default('0'),
    averageCpc: numeric('average_cpc', { precision: 10, scale: 2 }).default(
      '0',
    ),
    averageCpm: numeric('average_cpm', { precision: 10, scale: 2 }).default(
      '0',
    ),

    metricsStartDate: text('metrics_start_date'),
    metricsEndDate: text('metrics_end_date'),

    isActive: boolean('is_active').default(true).notNull(),
    lastFetchedAt: timestamp('last_fetched_at').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    adsCustomerIdIdx: index('campaigns_ads_customer_id_idx').on(
      table.adsCustomerId,
    ),
    campaignIdIdx: index('campaigns_campaign_id_idx').on(table.campaignId),
    statusIdx: index('campaigns_status_idx').on(table.status),
  }),
);

export const insertGoogleAdsCampaignSchema =
  createInsertSchema(googleAdsCampaigns);
export const selectGoogleAdsCampaignSchema =
  createSelectSchema(googleAdsCampaigns);

export type TInsertGoogleAdsCampaign = typeof googleAdsCampaigns.$inferInsert;
export type TSelectGoogleAdsCampaign = typeof googleAdsCampaigns.$inferSelect;

export const googleAdsCampaignsRelations = relations(
  googleAdsCampaigns,
  ({ one, many }) => ({
    adsCustomer: one(googleAdsCustomers, {
      fields: [googleAdsCampaigns.adsCustomerId],
      references: [googleAdsCustomers.id],
    }),
    adGroups: many(googleAdsAdGroups),
  }),
);
