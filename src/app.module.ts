import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DrizzleModule } from './modules/drizzle/drizzle.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { GoogleAuthModule } from './modules/google-auth/google-auth.module';
import { GoogleAdsModule } from './modules/google-ads/google-ads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      expandVariables: true,
      cache: true,
    }),
    DrizzleModule,
    GoogleAuthModule,
    GoogleAdsModule,
    SupabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
