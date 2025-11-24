import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { GoogleOauthRepository } from '../google-auth/google-oauth.repository';
import { TInsertSearchTerm } from '../../drizzle/schema/search-terms.schema';
import { ISyncResult } from './interfaces/google-ads.interface';
import { TSelectGoogleAdsCustomer } from 'src/drizzle/schema';

@Injectable()
export class GoogleAdsSyncService {
  private readonly logger = new Logger(GoogleAdsSyncService.name);

  constructor(
    private googleAdsService: GoogleAdsService,
    private googleOauthRepo: GoogleOauthRepository,
  ) {}

  /**
   * Syncs search terms from Google Ads API to the database.
   * Creates a sync job, fetches data, stores it, and updates job status.
   *
   * @returns Sync result containing job status and record counts
   */
  async syncSearchTerms(
    userId: string,
    customerId: string,
    loginCustomerId: string,
    startDate: string,
    endDate: string,
  ): Promise<ISyncResult> {
    const connection =
      await this.googleOauthRepo.getLatestActiveConnection(userId);

    if (!connection?.refreshToken) {
      throw new UnauthorizedException('No active Google connection found');
    }

    const adsCustomer = await this.getOrCreateAdsCustomer(
      userId,
      customerId,
      loginCustomerId,
      connection.id,
    );

    const job = await this.googleOauthRepo.createSyncJob({
      adsCustomerId: adsCustomer.id,
      syncStartDate: startDate,
      syncEndDate: endDate,
      status: 'running',
      startedAt: new Date(),
    });

    try {
      await this.googleOauthRepo.updateSyncJob(job.id, {
        status: 'running',
        startedAt: new Date(),
      });

      const searchTerms = await this.googleAdsService.fetchSearchTerms(
        customerId,
        loginCustomerId, // ✅ Pass it here
        connection.refreshToken,
        startDate,
        endDate,
      );

      const termsToInsert: TInsertSearchTerm[] = searchTerms.map((term) => ({
        adsCustomerId: adsCustomer.id,
        campaignId: term.campaignId,
        campaignName: term.campaignName,
        adGroupId: term.adGroupId,
        adGroupName: term.adGroupName,
        searchTerm: term.searchTerm,
        impressions: term.metrics.impressions,
        clicks: term.metrics.clicks,
        cost: term.metrics.cost,
        conversions: term.metrics.conversions,
        conversionsValue: term.metrics.conversionsValue,
        fetchedAt: new Date(),
      }));

      const recordsStored =
        await this.googleOauthRepo.bulkInsertSearchTerms(termsToInsert);

      await this.googleOauthRepo.updateSyncJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed: recordsStored,
      });

      await this.googleOauthRepo.updateCustomerLastSync(
        adsCustomer.id,
        new Date(),
      );

      return {
        jobId: job.id,
        customerId,
        customerName: adsCustomer.customerName || 'No Customer Name',
        status: 'completed',
        recordsFetched: searchTerms.length,
        recordsStored,
        startDate,
        endDate,
      };
    } catch (error) {
      this.logger.error('Sync failed', error);

      await this.googleOauthRepo.updateSyncJob(job.id, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message,
        errorDetails: { stack: error.stack },
      });

      throw error;
    }
  }

  /**
   * Gets existing Google Ads customer or creates a new one if it doesn't exist.
   * This ensures we have a database record for tracking sync jobs and search terms.
   *
   * @returns Google Ads customer database record
   */
  private async getOrCreateAdsCustomer(
    userId: string,
    customerId: string,
    loginCustomerId: string,
    oauthConnectionId: string,
  ): Promise<TSelectGoogleAdsCustomer> {
    const existing = await this.googleOauthRepo.getAdsCustomerByCustomerId(
      customerId,
      oauthConnectionId,
    );

    if (existing) {
      return existing;
    }

    return this.googleOauthRepo.createAdsCustomer({
      oauthConnectionId,
      customerId,
      loginCustomerId,
      customerName: `Customer ${customerId}`,
      customerDescriptiveName: null,
      isManagerAccount: false,
      managerCustomerId: null,
      currencyCode: 'USD',
      timeZone: 'UTC',
      isActive: true,
    });
  }

  /**
   * Ensures Google Ads customer exists in database.
   * Creates or updates the customer record.
   *
   * @returns Database customer record
   */
  async ensureCustomerExists(
    userId: string,
    customerId: string,
  ): Promise<TSelectGoogleAdsCustomer> {
    const connection =
      await this.googleOauthRepo.getLatestActiveConnection(userId);

    if (!connection) {
      throw new NotFoundException('No active Google OAuth connection found');
    }

    let adsCustomer = await this.googleOauthRepo.getAdsCustomerByCustomerId(
      customerId,
      connection.id,
    );

    if (adsCustomer) {
      this.logger.log(`Customer ${customerId} already exists in database`);
      return adsCustomer;
    }

    this.logger.log(`Fetching metadata for new customer ${customerId}`);

    const accounts = await this.googleAdsService.getAccessibleAccounts(
      connection.refreshToken,
    );

    const account = accounts.find((a) => a.customerId === customerId);

    if (!account) {
      throw new NotFoundException(
        `Customer ${customerId} not found in accessible accounts`,
      );
    }

    adsCustomer = await this.googleOauthRepo.createAdsCustomer({
      oauthConnectionId: connection.id,
      customerId: account.customerId,
      customerName: account.customerName,
      customerDescriptiveName: account.descriptiveName,
      loginCustomerId: account.loginCustomerId,
      isManagerAccount: account.isManagerAccount,
      managerCustomerId: account.managerCustomerId ?? null,
      currencyCode: account.currencyCode,
      timeZone: account.timeZone,
      isActive: true,
    });

    this.logger.log(`Created customer ${customerId} in database`);

    return adsCustomer;
  }
}
