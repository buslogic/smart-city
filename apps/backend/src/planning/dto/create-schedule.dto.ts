import { IsDateString, IsInt, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty({
    description: 'Datum rasporeda',
    example: '2025-10-20',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Broj linije',
    example: '7A',
  })
  @IsString()
  lineNumber: string;

  @ApiProperty({
    description: 'ID turnusa',
    example: 123,
  })
  @IsInt()
  turnusId: number;

  @ApiProperty({
    description: 'Broj smene (1, 2 ili 3)',
    example: 1,
  })
  @IsInt()
  shiftNumber: number;

  @ApiProperty({
    description: 'ID vozača',
    example: 456,
  })
  @IsInt()
  driverId: number;
}
