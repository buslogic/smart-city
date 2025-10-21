import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchAvailabilityDto {
  @ApiPropertyOptional({ description: 'Tekst pretrage' })
  @IsOptional()
  @IsString()
  query?: string = '';

  @ApiPropertyOptional({ description: 'Broj stranice', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pageNumber?: number = 0;

  @ApiPropertyOptional({ description: 'Broj rezultata po stranici', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
