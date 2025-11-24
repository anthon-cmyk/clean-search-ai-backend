import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FetchAdGroupsDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsString()
  loginCustomerId: string;

  @IsOptional()
  @IsString()
  campaignId?: string;
}
