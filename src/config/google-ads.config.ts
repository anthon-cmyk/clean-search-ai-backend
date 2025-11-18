import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const googleAdsConfigSchema = z.object({
  developerToken: z.string().min(1, 'Google Ads Developer Token is required'),
});

export type TGoogleAdsConfig = z.infer<typeof googleAdsConfigSchema>;

export default registerAs('googleAds', (): TGoogleAdsConfig => {
  const config = {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  };

  return googleAdsConfigSchema.parse(config);
});
