import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

import { SupabaseAuthService } from '../supabase/supabase-auth.service';
import { GoogleOauthRepository } from './google-oauth.repository';
import { GoogleAdsService } from '../google-ads/google-ads.service';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private oauth2Client: OAuth2Client;

  constructor(
    private configService: ConfigService,
    private googleOauthRepo: GoogleOauthRepository,
    private googleAdsService: GoogleAdsService,
    private supabaseAuth: SupabaseAuthService,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );
  }

  /**
   * Generates Google OAuth authorization URL.
   *
   * @param userId - Supabase user ID
   * @returns Authorization URL for user redirect
   */
  getAuthUrl(userId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: Buffer.from(JSON.stringify({ userId })).toString('base64'),
    });
  }

  /**
   * Handles complete OAuth callback flow:
   * 1. Validates user exists in Supabase
   * 2. Exchanges code for tokens
   * 3. Stores OAuth connection in database
   * 4. Fetches Google Ads accounts
   * 5. Stores each account in database
   *
   * @param code - Authorization code from Google
   * @param userId - User ID from state parameter
   * @returns Summary of connected accounts
   */
  async handleOAuthCallback(
    code: string,
    userId: string,
  ): Promise<{
    connectionId: string;
    googleEmail: string;
    accountsConnected: number;
  }> {
    // Validate user exists
    await this.supabaseAuth.validateUserExists(userId);

    // Exchange code for tokens (OAuth operation - stays in service)
    const { tokens, userInfo } = await this.exchangeCodeForTokens(code);

    // Calculate token expiry
    const tokenExpiresAt = new Date(
      Date.now() + ((tokens.expiry_date || Date.now() + 3600000) - Date.now()),
    );

    const existingConn = await this.googleOauthRepo.getConnectionByGoogleUserId(
      userId,
      userInfo.id,
    );

    const refreshTokenToUse =
      tokens.refresh_token ?? existingConn?.refreshToken;

    if (!refreshTokenToUse) {
      throw new UnauthorizedException(
        'No refresh token returned. Please revoke access in Google and reconnect.',
      );
    }

    // Store OAuth connection (delegates to repository)
    const oauthConnection = await this.googleOauthRepo.upsertOAuthConnection({
      userId,
      googleEmail: userInfo.email,
      googleUserId: userInfo.id,
      accessToken: tokens.access_token!,
      refreshToken: refreshTokenToUse,
      tokenExpiresAt,
      scopes: tokens.scope?.split(' ') || [],
      isActive: true,
    });

    this.logger.log(
      `OAuth connection created for user ${userId}, email ${userInfo.email}`,
    );

    // Fetch Google Ads accounts (external API call)
    const accounts = await this.googleAdsService.getAccessibleAccounts(
      tokens.refresh_token!,
    );

    // Store each account (delegates to repository)
    for (const account of accounts) {
      await this.googleOauthRepo.createAdsCustomer({
        oauthConnectionId: oauthConnection.id,
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
    }

    this.logger.log(
      `Connected ${accounts.length} Google Ads accounts for user ${userId}`,
    );

    return {
      connectionId: oauthConnection.id,
      googleEmail: userInfo.email,
      accountsConnected: accounts.length,
    };
  }

  /**
   * Exchanges authorization code for OAuth tokens (Google API interaction).
   * This is a pure OAuth operation, not database-related.
   */
  private async exchangeCodeForTokens(code: string): Promise<{
    tokens: Credentials;
    userInfo: {
      id: string;
      email: string;
      name?: string;
    };
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();

      if (!userInfo.id || !userInfo.email) {
        throw new UnauthorizedException('Failed to fetch user profile');
      }

      return {
        tokens,
        userInfo: {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name || undefined,
        },
      };
    } catch (error) {
      this.logger.error('Token exchange failed', error);
      throw new UnauthorizedException('Failed to authenticate with Google');
    }
  }

  /**
   * Refreshes expired access token (Google API interaction).
   */
  async refreshAccessToken(refreshToken: string): Promise<Credentials> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      throw new UnauthorizedException('Failed to refresh access token');
    }
  }
}
