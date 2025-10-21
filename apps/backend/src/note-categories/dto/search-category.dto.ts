import { IsString, IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SearchCategoryDto {
  @ApiPropertyOptional({ description: 'Tekst za pretragu' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({ description: 'Broj stranice (0-indexed)', example: 0 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  pageNumber?: number;
}
