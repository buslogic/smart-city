import { IsOptional, IsNumber, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchDto {
  @ApiPropertyOptional({ description: 'Search query' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({ description: 'Page number for pagination' })
  @IsNumber()
  @IsOptional()
  pageNumber?: number;
}
