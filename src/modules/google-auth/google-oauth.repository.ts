import { Injectable, Logger } from '@nestjs/common';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';

import { eq, and } from 'drizzle-orm';
import {
  googleOauthConnections,
  TInsertGoogleOauthConnection,
  TSelectGoogleOauthConnection,
} from 'src/drizzle/schema/google_oauth_connections.schema';
import { googleAdsCustomers } from 'src/drizzle/schema/google_ads_customers.schema';
import { DrizzleService } from '../drizzle/drizzle.service';

@Injectable()
export class GoogleOauthRepository {
  private readonly logger = new Logger(GoogleOauthRepository.name);

  constructor(
    private drizzle: DrizzleService,
    private supabaseAuth: SupabaseAuthService,
  ) {}

  async upsertOAuthConnection(
    data: TInsertGoogleOauthConnection,
  ): Promise<TSelectGoogleOauthConnection> {
    await this.supabaseAuth.validateUserExists(data.userId);

    const existing = await this.drizzle.db
      .select()
      .from(googleOauthConnections)
      .where(
        and(
          eq(googleOauthConnections.userId, data.userId),
          eq(googleOauthConnections.googleUserId, data.googleUserId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await this.drizzle.db
        .update(googleOauthConnections)
        .set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tokenExpiresAt: data.tokenExpiresAt,
          scopes: data.scopes,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(googleOauthConnections.id, existing[0].id))
        .returning();

      return updated;
    }

    const [created] = await this.drizzle.db
      .insert(googleOauthConnections)
      .values(data)
      .returning();

    return created;
  }

  async createAdsCustomer(
    data: TInsertGoogleAdsCustomer,
  ): Promise<TSelectGoogleAdsCustomer> {
    const existing = await this.drizzle.db
      .select()
      .from(googleAdsCustomers)
      .where(
        and(
          eq(googleAdsCustomers.oauthConnectionId, data.oauthConnectionId),
          eq(googleAdsCustomers.customerId, data.customerId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await this.drizzle.db
        .update(googleAdsCustomers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(googleAdsCustomers.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await this.drizzle.db
      .insert(googleAdsCustomers)
      .values(data)
      .returning();

    return created;
  }

  async getActiveConnectionsByUser(
    userId: string,
  ): Promise<TSelectGoogleOauthConnection[]> {
    return await this.drizzle.db
      .select()
      .from(googleOauthConnections)
      .where(
        and(
          eq(googleOauthConnections.userId, userId),
          eq(googleOauthConnections.isActive, true),
        ),
      );
  }
}
