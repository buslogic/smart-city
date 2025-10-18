import {
  IsInt,
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DayOfWeek {
  Ponedeljak = 'Ponedeljak',
  Utorak = 'Utorak',
  Sreda = 'Sreda',
  Četvrtak = 'Četvrtak',
  Petak = 'Petak',
  Subota = 'Subota',
  Nedelja = 'Nedelja',
}

export class CreateTurnusDefaultDto {
  @ApiProperty({
    description: 'ID vozača',
    example: 1,
  })
  @IsInt()
  @Type(() => Number)
  driverId: number;

  @ApiProperty({
    description: 'Naziv turnusa (npr. "00018-1")',
    example: '00018-1',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  turnusName: string;

  @ApiPropertyOptional({
    description: 'Broj linije (npr. "18")',
    example: '18',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  lineNumberForDisplay?: string;

  @ApiPropertyOptional({
    description: 'Broj smene (1 ili 2)',
    example: 1,
    minimum: 1,
    maximum: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  @Type(() => Number)
  shiftNumber?: number;

  @ApiPropertyOptional({
    description: 'Dan u nedelji',
    enum: DayOfWeek,
    example: DayOfWeek.Ponedeljak,
  })
  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({
    description: 'Prioritet (10-200, manji broj = veći prioritet)',
    example: 100,
    default: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(200)
  @Type(() => Number)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Da li je aktivan default',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Napomena',
    example: 'Vozač preferira jutarnju smenu na ovoj liniji',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
