import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SearchPaymentDto {
  @IsNotEmpty()
  @IsNumber()
  payer_id: number;
}

export class SearchCurrencyDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsNotEmpty()
  @IsNumber()
  pageNumber: number;
}
