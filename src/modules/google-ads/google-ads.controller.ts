import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SyncSearchTermsDto } from './dto/sync-search-terms.dto';
import { GoogleAdsSyncService } from './google-ads-sync.service';
import { ISyncResult } from './interfaces/google-ads.interface';

@Controller('google-ads')
export class GoogleAdsController {
  constructor(private googleAdsSyncService: GoogleAdsSyncService) {}

  @Post('sync-search-terms')
  async syncSearchTerms(
    @Body() dto: SyncSearchTermsDto,
    @Req() req: Request,
  ): Promise<ISyncResult> {
    const userId = req['user']?.id;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.googleAdsSyncService.syncSearchTerms(
      userId,
      dto.customerId,
      dto.startDate,
      dto.endDate,
    );
  }
}
