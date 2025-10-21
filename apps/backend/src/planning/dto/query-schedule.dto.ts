import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
