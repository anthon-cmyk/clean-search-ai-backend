import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseAuthService.name);

  private supabaseAdmin: SupabaseClient;
  private supabasePublic: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');
    const serviceRole = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !anonKey || !serviceRole) {
      throw new Error('Supabase env variables are missing');
    }

    // Admin client (for user lookup, DB operations)
    this.supabaseAdmin = createClient(url, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Public client (for token verification)
    this.supabasePublic = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /**
   * Validate access token from the client and return user payload.
   */
  async getUserFromAccessToken(token: string) {
    const { data, error } = await this.supabasePublic.auth.getUser(token);

    if (error || !data.user) {
      this.logger.warn(
        `Token validation failed: ${error?.message ?? 'Unknown'}`,
      );
      return null;
    }

    return data.user;
  }

  /**
   * Validate that a user exists (admin path).
   */
  async validateUserExists(userId: string) {
    const { data, error } =
      await this.supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !data.user) {
      this.logger.warn(
        `User validation failed for userId=${userId}: ${error?.message}`,
      );
      throw new NotFoundException(`User ${userId} does not exist`);
    }

    return data.user;
  }
}
