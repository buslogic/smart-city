import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetTurnusLinkInfoDto {
  @ApiProperty({
    description: 'Broj linije za prikaz (line_number_for_display)',
    example: '18',
  })
  @IsString()
  @IsNotEmpty()
  lineNumber: string;

  @ApiProperty({
    description: 'Naziv turnusa',
    example: '00018-1',
  })
  @IsString()
  @IsNotEmpty()
  turnusName: string;

  @ApiProperty({
    description: 'Broj smene (1, 2 ili 3)',
    example: 1,
    minimum: 1,
    maximum: 3,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  shiftNumber: number;

  @ApiProperty({
    description: 'Datum za koji se proverava linkovanje (YYYY-MM-DD)',
    example: '2025-01-20',
  })
  @IsString()
  @IsNotEmpty()
  date: string;
}
