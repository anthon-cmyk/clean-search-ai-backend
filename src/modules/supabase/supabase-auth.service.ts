import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import type { TSupabaseConfig } from '../../config/supabase.config';

@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseConfig = this.configService.get<TSupabaseConfig>('supabase');

    if (!supabaseConfig) {
      throw new Error('Supabase configuration is not loaded');
    }

    this.supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
  }

  /**
   * Validates that a user exists in Supabase auth.users table.
   * This provides runtime validation since we cannot use database-level
   * foreign keys across schemas (auth.users vs public.google_oauth_connections).
   *
   * @param userId - UUID of the user to validate
   * @throws NotFoundException if user does not exist
   * @returns User metadata if found
   */
  async validateUserExists(userId: string): Promise<{
    id: string;
    email: string | undefined;
    created_at: string;
  }> {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);

    if (error || !data.user) {
      this.logger.warn(`User validation failed for userId: ${userId}`);
      throw new NotFoundException(
        `User with ID ${userId} does not exist in Supabase Auth`,
      );
    }

    return {
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
    };
  }
}
