import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHouseCouncilDto {
  @IsNotEmpty()
  @IsString()
  idmm: string;

  @IsOptional()
  @IsString()
  adresa?: string;

  @IsOptional()
  @IsString()
  naselje?: string;

  @IsOptional()
  @IsString()
  datum_ugradnje?: string;

  @IsOptional()
  @IsString()
  broj_clanova_KS?: string;

  @IsOptional()
  @IsString()
  broj_potrosaca_KS?: string;

  @IsOptional()
  @IsString()
  prim_MM?: string;

  @IsOptional()
  @IsString()
  broj?: string;
}
