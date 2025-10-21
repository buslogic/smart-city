import { IsString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchItemsDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  pageNumber?: number;
}
