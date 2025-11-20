import { IsString, Matches, IsOptional } from 'class-validator';

export class FetchSearchTermsDto {
  @IsString() customerId: string;

  @IsOptional()
  @IsString()
  loginCustomerId?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate: string;
}
