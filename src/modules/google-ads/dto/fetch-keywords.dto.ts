import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FetchKeywordsDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsString()
  loginCustomerId: string;

  @IsNotEmpty()
  @IsString()
  adGroupId: string;

  @IsOptional()
  @IsString()
  campaignId?: string;
}
