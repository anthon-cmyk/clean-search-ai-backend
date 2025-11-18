import { z } from 'zod';

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
  scope: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type TOAuthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;
