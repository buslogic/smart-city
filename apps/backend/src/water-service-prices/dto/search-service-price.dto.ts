import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class SearchServicePriceDto {
  @ApiProperty({ description: 'Tekst pretrage', required: false })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({ description: 'Broj stranice', example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  pageNumber?: number;

  @ApiProperty({ description: 'Broj rezultata po stranici', example: 50, default: 50 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
