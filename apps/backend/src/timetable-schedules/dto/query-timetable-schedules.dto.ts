import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTimetableSchedulesDto {
  @ApiProperty({
    description: 'Datum grupe (YYYY-MM-DD format)',
    required: false,
    example: '2023-08-31',
  })
  @IsOptional()
  @IsString()
  dateValidFrom?: string;

  @ApiProperty({
    description: 'Broj stranice (default: 1)',
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Broj rekorda po stranici (default: 50)',
    required: false,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
