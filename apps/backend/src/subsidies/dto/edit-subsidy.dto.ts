import { IsString, IsInt, IsOptional, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class EditSubsidyDto {
  @IsInt()
  @Type(() => Number)
  id: number;

  @IsString()
  @IsNotEmpty()
  naziv: string;

  @IsString()
  @IsNotEmpty()
  tip: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  procenat?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  iznos?: number;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return null;
    // Ako je ISO format, konvertuj u YYYY-MM-DD
    if (typeof value === 'string' && value.includes('T')) {
      return value.split('T')[0];
    }
    return value;
  })
  datum_od?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return null;
    // Ako je ISO format, konvertuj u YYYY-MM-DD
    if (typeof value === 'string' && value.includes('T')) {
      return value.split('T')[0];
    }
    return value;
  })
  datum_do?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  fiksni_deo?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  varijabilni_deo?: number;

  @IsString()
  @IsNotEmpty()
  status: string;
}
