import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCashRegisterDto {
  @IsNotEmpty()
  @IsString()
  naziv: string;

  @IsOptional()
  @IsString()
  adresa?: string;

  @IsOptional()
  @IsString()
  fiscal_device?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
