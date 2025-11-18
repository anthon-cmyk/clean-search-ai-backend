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
import { encryptedText } from 'src/common/crypto/encrypted-text.type';
import { googleAdsCustomers } from './google_ads_customers.schema';

export const googleOauthConnections = pgTable(
  'google_oauth_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    googleEmail: text('google_email').notNull(),
    googleUserId: text('google_user_id').notNull().unique(),

    accessToken: encryptedText('access_token').notNull(),
    refreshToken: encryptedText('refresh_token').notNull(),
    tokenExpiresAt: timestamp('token_expires_at').notNull(),

    scopes: text('scopes').array().notNull(),
    isActive: boolean('is_active').default(true).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('google_oauth_connections_user_id_idx').on(table.userId),
    googleUserIdIdx: index('google_oauth_connections_google_user_id_idx').on(
      table.googleUserId,
    ),
  }),
);

const baseInsertSchema = createInsertSchema(googleOauthConnections);
const baseSelectSchema = createSelectSchema(googleOauthConnections);

export const insertGoogleOauthConnectionSchema = baseInsertSchema.extend({
  googleEmail: z.string().email('Invalid email format'),
  googleUserId: z.string().min(1, 'Google user ID required'),
  accessToken: z.string().min(1, 'Access token required'),
  refreshToken: z.string().min(1, 'Refresh token required'),
  scopes: z.array(z.string()).min(1, 'At least one scope required'),
  tokenExpiresAt: z.date().refine((date) => date > new Date(), {
    message: 'Token expiry must be in the future',
  }),
});

export const selectGoogleOauthConnectionSchema = baseSelectSchema;
export const updateGoogleOauthConnectionSchema =
  insertGoogleOauthConnectionSchema.partial();

export type TInsertGoogleOauthConnection = z.infer<
  typeof insertGoogleOauthConnectionSchema
>;
export type TSelectGoogleOauthConnection = z.infer<
  typeof selectGoogleOauthConnectionSchema
>;
export type TUpdateGoogleOauthConnection = z.infer<
  typeof updateGoogleOauthConnectionSchema
>;

export const googleOauthConnectionsRelations = relations(
  googleOauthConnections,
  ({ many }) => ({
    adsCustomers: many(googleAdsCustomers),
  }),
);
