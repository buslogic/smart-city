import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class UpdateLinkedTurnusDto {
  @ApiProperty({
    description: 'Broj linije prvog turnusa',
    required: false,
    example: '18',
  })
  @IsOptional()
  @IsString()
  lineNumber1?: string;

  @ApiProperty({
    description: 'ID prvog turnusa',
    required: false,
    example: 12345,
  })
  @IsOptional()
  @IsInt()
  turnusId1?: number;

  @ApiProperty({
    description: 'Naziv prvog turnusa',
    required: false,
    example: '00018-1',
  })
  @IsOptional()
  @IsString()
  turnusName1?: string;

  @ApiProperty({
    description: 'Smena prvog turnusa (1, 2 ili 3)',
    required: false,
    example: 1,
    minimum: 1,
    maximum: 3,
  })
  @IsOptional()
  @IsInt()
  shiftNumber1?: number;

  @ApiProperty({
    description: 'Broj linije drugog turnusa',
    required: false,
    example: '25',
  })
  @IsOptional()
  @IsString()
  lineNumber2?: string;

  @ApiProperty({
    description: 'ID drugog turnusa',
    required: false,
    example: 12346,
  })
  @IsOptional()
  @IsInt()
  turnusId2?: number;

  @ApiProperty({
    description: 'Naziv drugog turnusa',
    required: false,
    example: '00025-2',
  })
  @IsOptional()
  @IsString()
  turnusName2?: string;

  @ApiProperty({
    description: 'Smena drugog turnusa (1, 2 ili 3)',
    required: false,
    example: 2,
    minimum: 1,
    maximum: 3,
  })
  @IsOptional()
  @IsInt()
  shiftNumber2?: number;

  @ApiProperty({
    description: 'Napomena/opis povezivanja',
    required: false,
    example: 'Kratki turnusi koji se voze zajedno',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Status',
    enum: ['ACTIVE', 'INACTIVE'],
    required: false,
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @ApiProperty({
    description: 'Da li važi ponedeljkom',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  validMonday?: boolean;

  @ApiProperty({
    description: 'Da li važi utorkom',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  validTuesday?: boolean;

  @ApiProperty({
    description: 'Da li važi sredom',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  validWednesday?: boolean;

  @ApiProperty({
    description: 'Da li važi četvrtkom',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  validThursday?: boolean;

  @ApiProperty({
    description: 'Da li važi petkom',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  validFriday?: boolean;

  @ApiProperty({
    description: 'Da li važi subotom',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  validSaturday?: boolean;

  @ApiProperty({
    description: 'Da li važi nedeljom',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  validSunday?: boolean;
}
