import {
  IsInt,
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ConflictResolution {
  SKIP = 'skip',
  OVERWRITE = 'overwrite',
}

export class CreateMonthlyScheduleDto {
  @ApiProperty({
    description: 'Mesec (1-12)',
    example: 11,
    minimum: 1,
    maximum: 12,
  })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({
    description: 'Godina',
    example: 2025,
    minimum: 2024,
    maximum: 2030,
  })
  @IsInt()
  @Min(2024)
  @Max(2030)
  year: number;

  @ApiProperty({
    description: 'Broj linije za prikaz',
    example: '18',
  })
  @IsString()
  lineNumber: string;

  @ApiProperty({
    description: 'Naziv turnusa',
    example: '00018-1',
  })
  @IsString()
  turnusName: string;

  @ApiProperty({
    description: 'Broj smene (1, 2, 3)',
    example: 1,
    minimum: 1,
    maximum: 3,
  })
  @IsInt()
  @Min(1)
  @Max(3)
  shiftNumber: number;

  @ApiProperty({
    description:
      'Dani u nedelji za planiranje (0=Nedelja, 1=Ponedeljak, ..., 6=Subota). ' +
      'VAŽNO: Turnus mora saobraćati odabranim danima (proverava se turnus_days tabela)',
    example: [1, 2, 3, 4, 5],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  includedDaysOfWeek: number[];

  @ApiProperty({
    description:
      'Isključi specifične dane u mesecu (0=Nedelja, 1=Ponedeljak, ..., 6=Subota). ' +
      'Primenjuje se NAKON filtriranja po includedDaysOfWeek i turnus_days. ' +
      'Primer: Ako ste odabrali Pon-Pet, možete isključiti samo Utorak.',
    example: [2],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayMinSize(0)
  @ArrayMaxSize(7)
  excludedDaysOfWeek: number[];

  @ApiProperty({
    description: 'ID vozača',
    example: 15,
  })
  @IsInt()
  driverId: number;

  @ApiPropertyOptional({
    description:
      'Način rešavanja konflikata kada vozač već ima raspored za neke datume',
    enum: ConflictResolution,
    example: ConflictResolution.SKIP,
  })
  @IsOptional()
  @IsEnum(ConflictResolution)
  conflictResolution?: ConflictResolution;

  @ApiPropertyOptional({
    description:
      'Opcioni turnus za Subotu. Ako nije odabran, koristi se globalni turnusName. ' +
      'Mora saobraćati Subotom i imati istu smenu kao globalni turnus.',
    example: '00018-8',
  })
  @IsOptional()
  @IsString()
  saturdayTurnusName?: string;

  @ApiPropertyOptional({
    description:
      'Opcioni turnus za Nedelju. Ako nije odabran, koristi se globalni turnusName. ' +
      'Mora saobraćati Nedeljom i imati istu smenu kao globalni turnus.',
    example: '00018-12',
  })
  @IsOptional()
  @IsString()
  sundayTurnusName?: string;
}
