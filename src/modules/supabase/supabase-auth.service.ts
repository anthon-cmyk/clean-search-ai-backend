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
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('SUPABASE_URL');
    const anonKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!url || !anonKey) {
      throw new Error('Supabase environment variables are missing');
    }

    this.supabase = createClient(url, anonKey);
  }

  async validateUserExists(userId: string) {
    const { data, error } = await this.supabase.auth.admin.getUserById(userId);

    if (error || !data.user) {
      this.logger.warn(`User validation failed for userId: ${userId}`);
      throw new NotFoundException(`User ${userId} does not exist`);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
    };
  }
}
