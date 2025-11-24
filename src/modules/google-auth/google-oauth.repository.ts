import { Injectable, Logger } from '@nestjs/common';
import { SupabaseAuthService } from '../supabase/supabase-auth.service';

import { eq, and, desc, gte, lte } from 'drizzle-orm';
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
import {
  TInsertGoogleAdsAdGroup,
  TSelectGoogleAdsAdGroup,
  googleAdsAdGroups,
} from 'src/drizzle/schema/google_ads_ad_groups.schema';
import {
  TInsertGoogleAdsCampaign,
  TSelectGoogleAdsCampaign,
  googleAdsCampaigns,
} from 'src/drizzle/schema/google_ads_campaigns.schema';
import {
  TInsertGoogleAdsKeyword,
  googleAdsKeywords,
} from 'src/drizzle/schema/google_ads_keywords.schema';

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

    const existing = await this.getConnectionByGoogleUserId(
      data.userId,
      data.googleUserId,
    );

    if (existing) {
      const [updated] = await this.drizzle.db
        .update(googleOauthConnections)
        .set({
          accessToken: data.accessToken,
          // only overwrite if new one exists
          refreshToken: data.refreshToken ?? existing.refreshToken,
          tokenExpiresAt: data.tokenExpiresAt,
          scopes: data.scopes,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(googleOauthConnections.id, existing.id))
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

  async getLatestActiveConnection(userId: string) {
    const [conn] = await this.drizzle.db
      .select()
      .from(googleOauthConnections)
      .where(
        and(
          eq(googleOauthConnections.userId, userId),
          eq(googleOauthConnections.isActive, true),
        ),
      )
      .orderBy(desc(googleOauthConnections.createdAt))
      .limit(1);

    return conn ?? null;
  }

  async getConnectionByGoogleUserId(
    userId: string,
    googleUserId: string,
  ): Promise<TSelectGoogleOauthConnection | null> {
    const [conn] = await this.drizzle.db
      .select()
      .from(googleOauthConnections)
      .where(
        and(
          eq(googleOauthConnections.userId, userId),
          eq(googleOauthConnections.googleUserId, googleUserId),
        ),
      )
      .limit(1);

    return conn ?? null;
  }

  async getCustomersByUser(userId: string) {
    // join via oauthConnectionId
    return this.drizzle.db
      .select({
        id: googleAdsCustomers.id,
        customerId: googleAdsCustomers.customerId,
        customerName: googleAdsCustomers.customerName,
        customerDescriptiveName: googleAdsCustomers.customerDescriptiveName,
        loginCustomerId: googleAdsCustomers.loginCustomerId,
        isManagerAccount: googleAdsCustomers.isManagerAccount,
        managerCustomerId: googleAdsCustomers.managerCustomerId,
        currencyCode: googleAdsCustomers.currencyCode,
        timeZone: googleAdsCustomers.timeZone,
        lastSyncedAt: googleAdsCustomers.lastSyncedAt,
        isActive: googleAdsCustomers.isActive,
        oauthConnectionId: googleAdsCustomers.oauthConnectionId,
      })
      .from(googleAdsCustomers)
      .innerJoin(
        googleOauthConnections,
        eq(googleOauthConnections.id, googleAdsCustomers.oauthConnectionId),
      )
      .where(
        and(
          eq(googleOauthConnections.userId, userId),
          eq(googleOauthConnections.isActive, true),
          eq(googleAdsCustomers.isActive, true),
        ),
      )
      .orderBy(googleAdsCustomers.createdAt);
  }

  async getSyncJobsByCustomer(userId: string, customerId: string) {
    const adsCustomer = await this.getCustomerOwnedByUser(userId, customerId);
    if (!adsCustomer) return [];

    return this.drizzle.db
      .select()
      .from(syncJobs)
      .where(eq(syncJobs.adsCustomerId, adsCustomer.id))
      .orderBy(desc(syncJobs.createdAt))
      .limit(50);
  }

  private async getCustomerOwnedByUser(userId: string, customerId: string) {
    const [row] = await this.drizzle.db
      .select({
        id: googleAdsCustomers.id,
        customerId: googleAdsCustomers.customerId,
        loginCustomerId: googleAdsCustomers.loginCustomerId,
      })
      .from(googleAdsCustomers)
      .innerJoin(
        googleOauthConnections,
        eq(googleOauthConnections.id, googleAdsCustomers.oauthConnectionId),
      )
      .where(
        and(
          eq(googleOauthConnections.userId, userId),
          eq(googleAdsCustomers.customerId, customerId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async getStoredSearchTerms(
    userId: string,
    customerId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const adsCustomer = await this.getCustomerOwnedByUser(userId, customerId);
    if (!adsCustomer) return [];

    let whereClause = eq(searchTerms.adsCustomerId, adsCustomer.id);

    if (startDate && endDate) {
      whereClause = and(
        whereClause,
        gte(searchTerms.fetchedAt, new Date(startDate)),
        lte(searchTerms.fetchedAt, new Date(endDate)),
      )!;
    }

    return this.drizzle.db
      .select()
      .from(searchTerms)
      .where(whereClause)
      .orderBy(desc(searchTerms.fetchedAt))
      .limit(10000);
  }

  async upsertCampaign(
    data: TInsertGoogleAdsCampaign,
  ): Promise<TSelectGoogleAdsCampaign> {
    const [existing] = await this.drizzle.db
      .select()
      .from(googleAdsCampaigns)
      .where(
        and(
          eq(googleAdsCampaigns.adsCustomerId, data.adsCustomerId),
          eq(googleAdsCampaigns.campaignId, data.campaignId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.drizzle.db
        .update(googleAdsCampaigns)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(googleAdsCampaigns.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.drizzle.db
      .insert(googleAdsCampaigns)
      .values(data)
      .returning();

    return created;
  }

  async upsertAdGroup(
    data: TInsertGoogleAdsAdGroup,
  ): Promise<TSelectGoogleAdsAdGroup> {
    const [existing] = await this.drizzle.db
      .select()
      .from(googleAdsAdGroups)
      .where(
        and(
          eq(googleAdsAdGroups.campaignDbId, data.campaignDbId),
          eq(googleAdsAdGroups.adGroupId, data.adGroupId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.drizzle.db
        .update(googleAdsAdGroups)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(googleAdsAdGroups.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.drizzle.db
      .insert(googleAdsAdGroups)
      .values(data)
      .returning();

    return created;
  }

  async bulkUpsertKeywords(
    keywords: TInsertGoogleAdsKeyword[],
  ): Promise<number> {
    if (keywords.length === 0) return 0;

    let count = 0;
    for (const keyword of keywords) {
      const [existing] = await this.drizzle.db
        .select()
        .from(googleAdsKeywords)
        .where(
          and(
            eq(googleAdsKeywords.adGroupDbId, keyword.adGroupDbId),
            eq(googleAdsKeywords.keywordId, keyword.keywordId),
          ),
        )
        .limit(1);

      if (existing) {
        await this.drizzle.db
          .update(googleAdsKeywords)
          .set({ ...keyword, updatedAt: new Date() })
          .where(eq(googleAdsKeywords.id, existing.id));
      } else {
        await this.drizzle.db.insert(googleAdsKeywords).values(keyword);
      }
      count++;
    }

    return count;
  }
}
