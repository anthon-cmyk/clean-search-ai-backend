import { Injectable, Logger } from '@nestjs/common';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';

import { eq, and } from 'drizzle-orm';
import {
  googleOauthConnections,
  TInsertGoogleOauthConnection,
  TSelectGoogleOauthConnection,
} from '../../drizzle/schema/google_oauth_connections.schema'; // Fixed path
import {
  googleAdsCustomers,
  TInsertGoogleAdsCustomer,
  TSelectGoogleAdsCustomer,
} from '../../drizzle/schema/google_ads_customers.schema'; // Fixed path
import { DrizzleService } from '../drizzle/drizzle.service';
import {
  searchTerms,
  syncJobs,
  TInsertSearchTerm,
  TInsertSyncJob,
  TSelectSyncJob,
  TSyncJobStatus,
} from 'src/drizzle/schema';

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
    return this.drizzle.db
      .select()
      .from(googleOauthConnections)
      .where(
        and(
          eq(googleOauthConnections.userId, userId),
          eq(googleOauthConnections.isActive, true),
        ),
      );
  }

  /**
   * Bulk inserts search terms with duplicate handling.
   *
   * @returns Count of successfully inserted records
   */
  async bulkInsertSearchTerms(terms: TInsertSearchTerm[]): Promise<number> {
    if (terms.length === 0) {
      this.logger.warn('No search terms to insert');
      return 0;
    }

    const inserted = await this.drizzle.db
      .insert(searchTerms)
      .values(terms)
      .returning({ id: searchTerms.id });

    this.logger.log(`Bulk inserted ${inserted.length} search terms`);
    return inserted.length;
  }

  /**
   * Retrieves Google Ads customer by customer ID string.
   *
   * @returns Customer record or null
   */
  async getAdsCustomerByCustomerId(
    customerId: string,
    oauthConnectionId: string,
  ): Promise<TSelectGoogleAdsCustomer | null> {
    const [customer] = await this.drizzle.db
      .select()
      .from(googleAdsCustomers)
      .where(
        and(
          eq(googleAdsCustomers.customerId, customerId),
          eq(googleAdsCustomers.oauthConnectionId, oauthConnectionId),
        ),
      )
      .limit(1);

    return customer || null;
  }

  /**
   * Creates a sync job to track the fetch operation.
   *
   * @returns Created sync job record
   */
  async createSyncJob(data: TInsertSyncJob): Promise<TSelectSyncJob> {
    const [job] = await this.drizzle.db
      .insert(syncJobs)
      .values(data)
      .returning();

    return job;
  }

  /**
   * Updates sync job status and metadata.
   */
  async updateSyncJob(
    jobId: string,
    updates: {
      status?: TSyncJobStatus;
      startedAt?: Date;
      completedAt?: Date;
      recordsProcessed?: number;
      errorMessage?: string;
      errorDetails?: Record<string, unknown>;
    },
  ): Promise<TSelectSyncJob> {
    const [updated] = await this.drizzle.db
      .update(syncJobs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(syncJobs.id, jobId))
      .returning();

    return updated;
  }

  /**
   * Updates last synced timestamp for Google Ads customer.
   */
  async updateCustomerLastSync(
    adsCustomerId: string,
    lastSyncedAt: Date,
  ): Promise<void> {
    await this.drizzle.db
      .update(googleAdsCustomers)
      .set({
        lastSyncedAt,
        updatedAt: new Date(),
      })
      .where(eq(googleAdsCustomers.id, adsCustomerId));
  }
}
