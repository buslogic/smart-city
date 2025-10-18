import { IsDateString, IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class GetDriversAvailabilityDto {
  @ApiProperty({
    description: 'Datum za koji proveravamo dostupnost vozača',
    example: '2025-10-17',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Broj linije',
    example: '18',
  })
  @IsString()
  lineNumber: string;

  @ApiProperty({
    description: 'ID turnusa',
    example: 274281,
  })
  @Type(() => Number)
  @IsNumber()
  turnusId: number;

  @ApiProperty({
    description: 'Broj smene',
    example: 1,
  })
  @Type(() => Number)
  @IsNumber()
  shiftNumber: number;

  @ApiProperty({
    description: 'Vraća samo preporučene vozače (sa defaults)',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyRecommended?: boolean;
}
