import { IsEnum, IsNumber, IsBoolean, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CopyConfigDto {
  @ApiProperty({
    enum: ['batch', 'copy', 'auto'],
    description: 'Metoda za insert podataka u TimescaleDB',
    example: 'batch'
  })
  @IsEnum(['batch', 'copy', 'auto'])
  insertMethod: 'batch' | 'copy' | 'auto';

  @ApiProperty({
    minimum: 1000,
    maximum: 50000,
    description: 'Veličina batch-a za COPY metodu',
    example: 10000
  })
  @IsNumber()
  @Min(1000)
  @Max(50000)
  @IsOptional()
  copyBatchSize?: number;

  @ApiProperty({
    description: 'Da li da koristi fallback na batch ako COPY fail-uje',
    example: true
  })
  @IsBoolean()
  @IsOptional()
  fallbackToBatch?: boolean;
}

export class CopyConfigResponseDto extends CopyConfigDto {
  @ApiProperty({
    description: 'Procenjena brzina insertovanja (redova/sekund)',
    example: 8000
  })
  estimatedSpeed?: number;

  @ApiProperty({
    description: 'Preporučena metoda na osnovu trenutnih podešavanja',
    example: 'copy'
  })
  recommendedMethod?: string;
}