import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const supabaseConfigSchema = z.object({
  url: z.string().url('SUPABASE_URL must be a valid URL'),
  anonKey: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
});

export type TSupabaseConfig = z.infer<typeof supabaseConfigSchema>;

export default registerAs('supabase', (): TSupabaseConfig => {
  const config = {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  };

  const result = supabaseConfigSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Supabase configuration validation failed: ${result.error.message}`,
    );
  }

  return result.data;
});
