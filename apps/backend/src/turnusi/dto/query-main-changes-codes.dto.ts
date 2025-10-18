import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMainChangesCodesDto {
  @ApiProperty({
    description: 'ID grupe turnusa',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  groupId?: number;

  @ApiProperty({
    description: 'Broj linije',
    required: false,
    example: '7A',
  })
  @IsOptional()
  @IsString()
  lineNumber?: string;

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
