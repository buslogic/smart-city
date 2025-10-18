import { PartialType } from '@nestjs/swagger';
import { CreateTurnusDefaultDto } from './create-turnus-default.dto';
import { IsOptional, IsInt, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTurnusDefaultDto extends PartialType(CreateTurnusDefaultDto) {
  @ApiPropertyOptional({
    description: 'Broj korišćenja',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  usageCount?: number;

  @ApiPropertyOptional({
    description: 'Procenat korišćenja',
    example: 75.5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  usagePercentage?: number;

  @ApiPropertyOptional({
    description: 'Confidence score',
    example: 85.5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  confidenceScore?: number;
}
