import { IsString, IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchCategoryDto {
  @ApiPropertyOptional({ description: 'Query za pretragu kategorija' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({ description: 'Broj stranice', example: 0 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  pageNumber?: number;
}
