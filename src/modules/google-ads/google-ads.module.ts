import { forwardRef, Module } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleAdsSyncService } from './google-ads-sync.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { GoogleAuthModule } from '../google-auth/google-auth.module';
import { GoogleAdsFullSyncService } from './google-ads-full-sync.service';

@Module({
  imports: [DrizzleModule, SupabaseModule, forwardRef(() => GoogleAuthModule)],
  controllers: [GoogleAdsController],
  providers: [GoogleAdsService, GoogleAdsSyncService, GoogleAdsFullSyncService],
  exports: [GoogleAdsService, GoogleAdsSyncService, GoogleAdsFullSyncService],
})
export class GoogleAdsModule {}
