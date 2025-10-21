import { IsString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchSubsidiesDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  pageNumber?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  pageSize?: number;

  @IsString()
  @IsOptional()
  tip?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  subvencija?: string;

  @IsString()
  @IsOptional()
  godina?: string;
}
