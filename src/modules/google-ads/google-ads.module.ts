import { forwardRef, Module } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleAdsSyncService } from './google-ads-sync.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { GoogleAuthModule } from '../google-auth/google-auth.module';

@Module({
  imports: [DrizzleModule, SupabaseModule, forwardRef(() => GoogleAuthModule)],
  controllers: [GoogleAdsController],
  providers: [GoogleAdsService, GoogleAdsSyncService],
  exports: [GoogleAdsService, GoogleAdsSyncService],
})
export class GoogleAdsModule {}
