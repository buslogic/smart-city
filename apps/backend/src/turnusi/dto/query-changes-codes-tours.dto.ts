import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryChangesCodeToursDto {
  @ApiProperty({
    description: 'Naziv grupe turnusa',
    required: false,
    example: 'Grupa 1',
  })
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiProperty({
    description: 'Broj stranice (1-based)',
    required: false,
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Broj rekorda po stranici',
    required: false,
    example: 50,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
