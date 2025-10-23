import { IsDateString, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryScheduleDto {
  @ApiProperty({
    description: 'Datum rasporeda',
    required: false,
    example: '2025-10-20',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class QueryTurnusiDto {
  @ApiProperty({
    description: 'Broj linije',
    example: '7A',
  })
  @IsString()
  lineNumber: string;

  @ApiProperty({
    description: 'Datum za određivanje dana u nedelji',
    example: '2025-10-20',
  })
  @IsDateString()
  date: string;
}

export class QueryMonthlyScheduleDto {
  @ApiProperty({
    description: 'Mesec (1-12)',
    example: 10,
    minimum: 1,
    maximum: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({
    description: 'Godina',
    example: 2025,
    minimum: 2020,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @ApiProperty({
    description: 'Broj linije',
    example: '18',
  })
  @IsString()
  lineNumber: string;
}
