import { IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class FetchCampaignsDto {
  @IsString()
  customerId: string;

  @IsString()
  loginCustomerId: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsOptional()
  includeAdGroups?: boolean;
}
