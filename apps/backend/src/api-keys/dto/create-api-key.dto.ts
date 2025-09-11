import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsInt, Min, IsDateString } from 'class-validator';
import { ApiKeyType } from '@prisma/client';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Naziv API ključa',
    example: 'Production Swagger Access',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Opis namene API ključa',
    example: 'Ključ za pristup Swagger dokumentaciji u produkciji',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Tip API ključa',
    enum: ApiKeyType,
    example: ApiKeyType.SWAGGER_ACCESS,
  })
  @IsEnum(ApiKeyType)
  type: ApiKeyType;

  @ApiProperty({
    description: 'Lista dozvola (permissions)',
    example: ['swagger:read', 'api:read'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiProperty({
    description: 'Lista dozvoljenih IP adresa',
    example: ['192.168.1.100', '10.0.0.0/24'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @ApiProperty({
    description: 'Rate limit - broj zahteva po satu',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimit?: number;

  @ApiProperty({
    description: 'Datum isteka ključa (ISO string)',
    example: '2025-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}