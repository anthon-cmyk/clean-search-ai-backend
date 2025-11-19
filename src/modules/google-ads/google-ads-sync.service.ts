import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { GoogleOauthRepository } from '../google-auth/google-oauth.repository';
import { TInsertSearchTerm } from '../../drizzle/schema/search-terms.schema';
import { ISyncResult } from './interfaces/google-ads.interface';

@Injectable()
export class GoogleAdsSyncService {
  private readonly logger = new Logger(GoogleAdsSyncService.name);

  constructor(
    private googleAdsService: GoogleAdsService,
    private googleOauthRepo: GoogleOauthRepository,
  ) {}

  /**
   * Orchestrates the complete sync pipeline:
   * 1. Validates user and customer
   * 2. Creates sync job for tracking
   * 3. Fetches search terms from Google Ads API
   * 4. Transforms and stores data in database
   * 5. Updates sync job and customer metadata
   *
   * @returns Comprehensive sync result with job tracking
   */
  async syncSearchTerms(
    userId: string,
    customerId: string,
    startDate: string,
    endDate: string,
  ): Promise<ISyncResult> {
    const connections =
      await this.googleOauthRepo.getActiveConnectionsByUser(userId);

    if (connections.length === 0) {
      throw new NotFoundException('No active Google OAuth connections found');
    }

    const connection = connections[0];

    const adsCustomer = await this.googleOauthRepo.getAdsCustomerByCustomerId(
      customerId,
      connection.id,
    );

    if (!adsCustomer) {
      throw new NotFoundException(
        `Google Ads customer ${customerId} not found for this user`,
      );
    }

    const syncJob = await this.googleOauthRepo.createSyncJob({
      adsCustomerId: adsCustomer.id,
      status: 'pending',
      syncStartDate: startDate,
      syncEndDate: endDate,
      syncType: 'manual',
    });

    this.logger.log(
      `Created sync job ${syncJob.id} for customer ${customerId}`,
    );

    try {
      await this.googleOauthRepo.updateSyncJob(syncJob.id, {
        status: 'running',
        startedAt: new Date(),
      });

      this.logger.log(
        `Fetching search terms for customer ${customerId} from ${startDate} to ${endDate}`,
      );

      const searchTermsData = await this.googleAdsService.fetchSearchTerms(
        adsCustomer.customerId,
        adsCustomer.loginCustomerId,
        connection.refreshToken,
        startDate,
        endDate,
      );

      const fetchedAt = new Date();
      const searchTermsToInsert: TInsertSearchTerm[] = searchTermsData.map(
        (term) => ({
          adsCustomerId: adsCustomer.id,
          campaignId: term.campaignId,
          campaignName: term.campaignName,
          adGroupId: term.adGroupId,
          adGroupName: term.adGroupName,
          searchTerm: term.searchTerm,
          keyword: term.keyword,
          metrics: {
            impressions: term.metrics.impressions,
            clicks: term.metrics.clicks,
            cost: term.metrics.cost,
            conversions: term.metrics.conversions,
          },
          fetchedAt,
        }),
      );

      const storedCount =
        await this.googleOauthRepo.bulkInsertSearchTerms(searchTermsToInsert);

      await this.googleOauthRepo.updateSyncJob(syncJob.id, {
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed: storedCount,
      });

      await this.googleOauthRepo.updateCustomerLastSync(
        adsCustomer.id,
        new Date(),
      );

      this.logger.log(
        `Sync job ${syncJob.id} completed: ${storedCount}/${searchTermsData.length} records stored`,
      );

      return {
        jobId: syncJob.id,
        customerId: adsCustomer.customerId,
        customerName: adsCustomer.customerName || 'Unknown',
        status: 'completed',
        recordsFetched: searchTermsData.length,
        recordsStored: storedCount,
        startDate,
        endDate,
      };
    } catch (error) {
      this.logger.error(
        `Sync job ${syncJob.id} failed for customer ${customerId}`,
        error,
      );

      await this.googleOauthRepo.updateSyncJob(syncJob.id, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message,
        errorDetails: {
          stack: error.stack,
          name: error.name,
        },
      });

      return {
        jobId: syncJob.id,
        customerId: adsCustomer.customerId,
        customerName: adsCustomer.customerName || 'Unknown',
        status: 'failed',
        recordsFetched: 0,
        recordsStored: 0,
        startDate,
        endDate,
        errorMessage: error.message,
      };
    }
  }
}
