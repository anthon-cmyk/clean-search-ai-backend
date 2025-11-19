import { Module } from '@nestjs/common';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { GoogleOauthRepository } from './google-oauth.repository';
import { SupabaseModule } from '../supabase/supabase.module';
import { GoogleAdsModule } from '../google-ads/google-ads.module';

@Module({
  imports: [GoogleAdsModule, SupabaseModule],
  controllers: [GoogleAuthController],
  providers: [GoogleAuthService, GoogleOauthRepository],
  exports: [GoogleAuthService, GoogleOauthRepository],
})
export class GoogleAuthModule {}
