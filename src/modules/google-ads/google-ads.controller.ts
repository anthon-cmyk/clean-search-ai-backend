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
} from '@nestjs/common';
import { SyncSearchTermsDto } from './dto/sync-search-terms.dto';
import { GoogleAdsSyncService } from './google-ads-sync.service';
import {
  IGoogleAdsAccount,
  IGoogleAdsSearchTerm,
  ISyncResult,
} from './interfaces/google-ads.interface';
import { GoogleAdsService } from './google-ads.service';
import { FetchSearchTermsDto } from 'src/dto/fetch-search-terms.dto';
import type { TAuthenticatedRequest } from 'src/types/authenticated-request.type';
import { GoogleOauthRepository } from '../google-auth/google-oauth.repository';
import { SupabaseAuthGuard } from '../supabase/guards/supabase-auth.guard';

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
   * Fetches search terms data from Google Ads for a specific customer account and date range.
   * Returns the actual search queries users typed that triggered ads.
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

    return this.googleAdsService.fetchSearchTerms(
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
}
