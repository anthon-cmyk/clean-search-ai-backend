import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  boolean,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { searchTerms } from './search-terms.schema';
import { syncJobs } from './sync-jobs.schema';
import { googleOauthConnections } from './google_oauth_connections.schema';

export const googleAdsCustomers = pgTable(
  'google_ads_customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    oauthConnectionId: uuid('oauth_connection_id')
      .notNull()
      .references(() => googleOauthConnections.id, { onDelete: 'cascade' }),

    customerId: text('customer_id').notNull(),
    customerName: text('customer_name'),
    customerDescriptiveName: text('customer_descriptive_name'),

    // The ID you use for authentication
    // For manager accounts, this is the manager's ID
    // For direct accounts, this is the same as customerId
    loginCustomerId: text('login_customer_id').notNull(),

    // Manager account info if applicable
    isManagerAccount: boolean('is_manager_account').default(false).notNull(),
    managerCustomerId: text('manager_customer_id'),

    isActive: boolean('is_active').default(true).notNull(),
    lastSyncedAt: timestamp('last_synced_at'),

    accountLevel: text('account_level'), // 'CLIENT', 'MANAGER', 'TEST'
    currencyCode: text('currency_code'),
    timeZone: text('time_zone'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    oauthConnectionIdIdx: index(
      'google_ads_customers_oauth_connection_id_idx',
    ).on(table.oauthConnectionId),
    customerIdIdx: index('google_ads_customers_customer_id_idx').on(
      table.customerId,
    ),
    // Compound unique constraint: one customer per oauth connection
    uniqueCustomerPerConnection: unique('oauth_customer_unique').on(
      table.oauthConnectionId,
      table.customerId,
    ),
  }),
);

const baseInsertSchema = createInsertSchema(googleAdsCustomers);
const baseSelectSchema = createSelectSchema(googleAdsCustomers);

export const insertGoogleAdsCustomerSchema = baseInsertSchema.extend({
  customerId: z.string().min(1, 'Customer ID required'),
  customerName: z.string().optional(),
});

export const selectGoogleAdsCustomerSchema = baseSelectSchema;
export const updateGoogleAdsCustomerSchema =
  insertGoogleAdsCustomerSchema.partial();

export type TInsertGoogleAdsCustomer = z.infer<
  typeof insertGoogleAdsCustomerSchema
>;
export type TSelectGoogleAdsCustomer = z.infer<
  typeof selectGoogleAdsCustomerSchema
>;
export type TUpdateGoogleAdsCustomer = z.infer<
  typeof updateGoogleAdsCustomerSchema
>;

export const googleAdsCustomersRelations = relations(
  googleAdsCustomers,
  ({ one, many }) => ({
    oauthConnection: one(googleOauthConnections, {
      fields: [googleAdsCustomers.oauthConnectionId],
      references: [googleOauthConnections.id],
    }),
    searchTerms: many(searchTerms),
    syncJobs: many(syncJobs),
  }),
);
