import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class UpdateApiKeyDto {
  @ApiProperty({
    description: 'Naziv API ključa',
    example: 'Updated API Key Name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Opis namene API ključa',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Lista dozvola (permissions)',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiProperty({
    description: 'Lista dozvoljenih IP adresa',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @ApiProperty({
    description: 'Rate limit - broj zahteva po satu',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimit?: number;

  @ApiProperty({
    description: 'Datum isteka ključa (ISO string)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({
    description: 'Da li je ključ aktivan',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RevokeApiKeyDto {
  @ApiProperty({
    description: 'Razlog revokovanja ključa',
    example: 'Sigurnosni incident - ključ je kompromitovan',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
