import {
  Controller,
  Get,
  Query,
  Redirect,
  UnauthorizedException,
  Req,
  Request,
} from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';

@Controller('google-auth')
export class GoogleAuthController {
  constructor(private googleAuthService: GoogleAuthService) {}

  @Get('authorize')
  @Redirect()
  authorize(@Req() req: Request) {
    const userId = req['user']?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const authUrl = this.googleAuthService.getAuthUrl(userId);
    return { url: authUrl };
  }

  @Get('callback')
  @Redirect()
  async callback(@Query('code') code: string, @Query('state') state: string) {
    if (!code) {
      throw new UnauthorizedException('No authorization code provided');
    }

    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    const result = await this.googleAuthService.handleOAuthCallback(
      code,
      userId,
    );

    return {
      url: `${process.env.FRONTEND_URL}/dashboard?connected=true&accounts=${result.accountsConnected}`,
    };
  }
}
