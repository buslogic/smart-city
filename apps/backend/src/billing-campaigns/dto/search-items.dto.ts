import { IsString, IsInt, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchItemsDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  pageNumber?: number;
}
