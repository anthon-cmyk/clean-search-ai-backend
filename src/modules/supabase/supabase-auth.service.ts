import {
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseAuthService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private supabaseAdmin: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!url || !serviceRoleKey) {
      throw new Error('Supabase environment variables are missing');
    }

    this.supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async validateUserExists(userId: string) {
    const { data, error } =
      await this.supabaseAdmin.auth.admin.getUserById(userId);

    if (error || !data.user) {
      this.logger.warn(
        `User validation failed for userId: ${userId}`,
        error?.message,
      );
      throw new NotFoundException(`User ${userId} does not exist`);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      createdAt: data.user.created_at,
    };
  }
}
