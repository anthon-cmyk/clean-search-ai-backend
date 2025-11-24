import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
  Get,
  Query,
  BadRequestException,
  UseGuards,
  Param,
} from '@nestjs/common';
import { SyncSearchTermsDto } from './dto/sync-search-terms.dto';
import { GoogleAdsSyncService } from './google-ads-sync.service';
import {
  IGoogleAdsAccount,
  IGoogleAdsAdGroup,
  IGoogleAdsCampaign,
  IGoogleAdsKeyword,
  IGoogleAdsSearchTerm,
  ISyncResult,
} from './interfaces/google-ads.interface';
import { GoogleAdsService } from './google-ads.service';
import { FetchSearchTermsDto } from 'src/dto/fetch-search-terms.dto';
import type { TAuthenticatedRequest } from 'src/types/authenticated-request.type';
import { GoogleOauthRepository } from '../google-auth/google-oauth.repository';
import { SupabaseAuthGuard } from '../supabase/guards/supabase-auth.guard';
import { FetchCampaignsDto } from 'src/dto/fetch-campaigns.dto';
import { FetchKeywordsDto } from './dto/fetch-keywords.dto';
import { FetchAdGroupsDto } from './dto/fetch-ad-groups.dto';

@UseGuards(SupabaseAuthGuard)
@Controller('google-ads')
export class GoogleAdsController {
  constructor(
    private googleAdsSyncService: GoogleAdsSyncService,
    private googleAdsService: GoogleAdsService,
    private googleOauthRepo: GoogleOauthRepository,
  ) {}

  @Get('customers')
  async getCustomers(@Req() req: TAuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.googleOauthRepo.getCustomersByUser(userId);
  }

  @Get('sync-jobs')
  async getSyncJobs(
    @Req() req: TAuthenticatedRequest,
    @Query('customerId') customerId: string,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    if (!customerId) throw new BadRequestException('customerId required');

    return this.googleOauthRepo.getSyncJobsByCustomer(userId, customerId);
  }

  @Get('search-terms/stored')
  async getStoredTerms(
    @Req() req: TAuthenticatedRequest,
    @Query('customerId') customerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    if (!customerId) throw new BadRequestException('customerId required');

    return this.googleOauthRepo.getStoredSearchTerms(
      userId,
      customerId,
      startDate,
      endDate,
    );
  }

  /**
   * Retrieves all accessible Google Ads accounts for the authenticated user.
   * Requires user to have a valid Google refresh token stored.
   *
   * @returns Array of accessible Google Ads customer accounts with metadata
   * @throws UnauthorizedException if user is not authenticated or missing refresh token
   */
  @Get('accounts')
  async getAccessibleAccounts(
    @Req() req: TAuthenticatedRequest,
  ): Promise<IGoogleAdsAccount[]> {
    const userId = req.user?.id;

    const connection = await this.googleOauthRepo.getLatestActiveConnection(
      userId!,
    );
    if (!connection) throw new UnauthorizedException('Not connected');

    const refreshToken = connection.refreshToken;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Google Ads account not connected. Please connect your Google Ads account first.',
      );
    }

    return this.googleAdsService.getAccessibleAccounts(refreshToken);
  }

  /**
   * Retrieves all client accounts managed by a specific MCC account.
   *
   * @returns Array of managed customer accounts with their hierarchy information
   * @throws UnauthorizedException if user is not authenticated or missing refresh token
   */
  @Get('managed-accounts/:mccCustomerId')
  async getManagedAccounts(
    @Param('mccCustomerId') mccCustomerId: string,
    @Req() req: TAuthenticatedRequest,
  ): Promise<IGoogleAdsAccount[]> {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const connection =
      await this.googleOauthRepo.getLatestActiveConnection(userId);

    if (!connection) {
      throw new UnauthorizedException('Not connected');
    }

    const refreshToken = connection.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Google Ads account not connected. Please connect your Google Ads account first.',
      );
    }

    return this.googleAdsService.getManagedAccounts(
      mccCustomerId,
      refreshToken,
    );
  }

  /**
   * Fetches search terms data from Google Ads for a specific customer account and date range.
   * Returns the actual search queries users typed that triggered ads.
   * Optionally filter by campaign ID and/or ad group ID.
   *
   * @returns Array of search term records with campaign, ad group, keyword, and performance metrics
   * @throws UnauthorizedException if user is not authenticated or missing refresh token
   */
  @Get('search-terms')
  async fetchSearchTerms(
    @Query() dto: FetchSearchTermsDto,
    @Req() req: TAuthenticatedRequest,
  ): Promise<IGoogleAdsSearchTerm[]> {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const connection =
      await this.googleOauthRepo.getLatestActiveConnection(userId);

    if (!connection) {
      throw new UnauthorizedException('Not connected');
    }

    const refreshToken = connection.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Google Ads account not connected. Please connect your Google Ads account first.',
      );
    }

    return this.googleAdsService.fetchSearchTerms(
      dto.customerId,
      dto.loginCustomerId,
      refreshToken,
      dto.startDate,
      dto.endDate,
      dto.campaignId,
      dto.adGroupId,
    );
  }

  /**
   * Retrieves all campaigns for a specific Google Ads customer account.
   *
   * Without date range parameters: Returns campaign metadata only (fast, lightweight).
   * With date range parameters: Includes performance metrics for the specified period.
   *
   * @returns Array of campaign objects with metadata and optional performance data
   *
   * @throws UnauthorizedException if user is not authenticated or refresh token is missing
   * @throws BadRequestException if date range validation fails
   */
  @Get('campaigns')
  async fetchCampaigns(
    @Query() dto: FetchCampaignsDto,
    @Req() req: TAuthenticatedRequest,
  ): Promise<IGoogleAdsCampaign[]> {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const connection =
      await this.googleOauthRepo.getLatestActiveConnection(userId);

    if (!connection) {
      throw new UnauthorizedException('Not connected');
    }

    const refreshToken = connection.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Google Ads account not connected. Please connect your Google Ads account first.',
      );
    }

    return this.googleAdsService.fetchCampaigns(
      dto.customerId,
      dto.loginCustomerId,
      refreshToken,
      dto.startDate,
      dto.endDate,
    );
  }

  /**
   * Syncs search terms data to the database for the specified customer and date range.
   * This is a higher-level operation that fetches and persists data.
   *
   * @returns Sync result with statistics about the operation
   * @throws UnauthorizedException if user is not authenticated
   */
  @Post('sync-search-terms')
  async syncSearchTerms(
    @Body() dto: SyncSearchTermsDto,
    @Req() req: Request,
  ): Promise<ISyncResult> {
    const userId = req['user']?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.googleAdsSyncService.syncSearchTerms(
      userId,
      dto.customerId,
      dto.startDate,
      dto.endDate,
    );
  }

  /**
   * Retrieves all ad groups for a specific Google Ads customer account.
   * Optionally filter by campaign ID to get ad groups within a specific campaign.
   *
   * Ad groups are organizational containers within campaigns that group related
   * keywords and ads together by theme or targeting.
   *
   * @returns Array of ad group objects with metadata and bidding information
   *
   * @throws UnauthorizedException if user is not authenticated or refresh token is missing
   * @throws BadRequestException if required parameters are missing
   */
  @Get('ad-groups')
  async fetchAdGroups(
    @Query() dto: FetchAdGroupsDto,
    @Req() req: TAuthenticatedRequest,
  ): Promise<IGoogleAdsAdGroup[]> {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const connection =
      await this.googleOauthRepo.getLatestActiveConnection(userId);

    if (!connection) {
      throw new UnauthorizedException('Not connected');
    }

    const refreshToken = connection.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Google Ads account not connected. Please connect your Google Ads account first.',
      );
    }

    return this.googleAdsService.fetchAdGroups(
      dto.customerId,
      dto.loginCustomerId,
      refreshToken,
      dto.campaignId,
    );
  }

  /**
   * Retrieves all keywords for a specific ad group in Google Ads.
   * Returns targeting keywords with bid amounts, match types, and quality scores.
   *
   * Keywords are the search terms you bid on in Google Ads. This endpoint
   * returns the configured keywords in an ad group, not the actual search
   * terms users typed (use /search-terms for that).
   *
   * @returns Array of keyword objects with targeting and performance data
   *
   * @throws UnauthorizedException if user is not authenticated or refresh token is missing
   * @throws BadRequestException if required parameters are missing
   */
  @Get('keywords')
  async fetchKeywords(
    @Query() dto: FetchKeywordsDto,
    @Req() req: TAuthenticatedRequest,
  ): Promise<IGoogleAdsKeyword[]> {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const connection =
      await this.googleOauthRepo.getLatestActiveConnection(userId);

    if (!connection) {
      throw new UnauthorizedException('Not connected');
    }

    const refreshToken = connection.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Google Ads account not connected. Please connect your Google Ads account first.',
      );
    }

    return this.googleAdsService.fetchKeywords(
      dto.customerId,
      dto.loginCustomerId,
      refreshToken,
      dto.adGroupId,
      dto.campaignId,
    );
  }
}
