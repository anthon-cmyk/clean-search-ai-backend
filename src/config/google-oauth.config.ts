import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const googleOAuthConfigSchema = z.object({
  clientId: z.string().min(1, 'Google Client ID is required'),
  clientSecret: z.string().min(1, 'Google Client Secret is required'),
  redirectUri: z.string().url('Invalid redirect URI'),
  scopes: z
    .array(z.string())
    .default([
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/adwords',
    ]),
});

export type TGoogleOAuthConfig = z.infer<typeof googleOAuthConfigSchema>;

export default registerAs('googleOAuth', (): TGoogleOAuthConfig => {
  const config = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/adwords',
    ],
  };

  return googleOAuthConfigSchema.parse(config);
});
