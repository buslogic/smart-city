import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsIn } from 'class-validator';

export class CreateLinkedTurnusDto {
  @ApiProperty({
    description: 'Broj linije prvog turnusa',
    example: '18',
  })
  @IsString()
  lineNumber1: string;

  @ApiProperty({
    description: 'ID prvog turnusa',
    example: 12345,
  })
  @IsInt()
  turnusId1: number;

  @ApiProperty({
    description: 'Naziv prvog turnusa',
    example: '00018-1',
  })
  @IsString()
  turnusName1: string;

  @ApiProperty({
    description: 'Smena prvog turnusa (1, 2 ili 3)',
    example: 1,
    minimum: 1,
    maximum: 3,
  })
  @IsInt()
  shiftNumber1: number;

  @ApiProperty({
    description: 'Broj linije drugog turnusa',
    example: '25',
  })
  @IsString()
  lineNumber2: string;

  @ApiProperty({
    description: 'ID drugog turnusa',
    example: 12346,
  })
  @IsInt()
  turnusId2: number;

  @ApiProperty({
    description: 'Naziv drugog turnusa',
    example: '00025-2',
  })
  @IsString()
  turnusName2: string;

  @ApiProperty({
    description: 'Smena drugog turnusa (1, 2 ili 3)',
    example: 2,
    minimum: 1,
    maximum: 3,
  })
  @IsInt()
  shiftNumber2: number;

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
    default: 'ACTIVE',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
