import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './modules/drizzle/drizzle.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { GoogleAuthModule } from './modules/google-auth/google-auth.module';
import { GoogleAdsModule } from './modules/google-ads/google-ads.module';

@Module({
  imports: [DrizzleModule, GoogleAuthModule, GoogleAdsModule, SupabaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
