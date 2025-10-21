import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsDateString } from 'class-validator';

export class GetHistoryDto {
  @ApiProperty({ description: 'ID cenovnika', example: 1 })
  @IsInt()
  pricelist_id: number;

  @ApiProperty({
    description: 'Datum od (YYYY-MM-DD)',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({
    description: 'Datum do (YYYY-MM-DD)',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;
}
