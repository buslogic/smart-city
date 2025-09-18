import { ApiProperty } from '@nestjs/swagger';
import { ApiKeyType } from '@prisma/client';

export class ApiKeyResponseDto {
  @ApiProperty({ description: 'ID API ključa' })
  id: number;

  @ApiProperty({
    description: 'Poslednje 4 karaktera ključa za identifikaciju',
  })
  displayKey: string;

  @ApiProperty({ description: 'Naziv ključa' })
  name: string;

  @ApiProperty({ description: 'Opis ključa', required: false })
  description?: string;

  @ApiProperty({ description: 'Tip ključa', enum: ApiKeyType })
  type: ApiKeyType;

  @ApiProperty({ description: 'Lista dozvola', required: false })
  permissions?: string[];

  @ApiProperty({ description: 'Lista dozvoljenih IP adresa', required: false })
  allowedIps?: string[];

  @ApiProperty({ description: 'Rate limit po satu', required: false })
  rateLimit?: number;

  @ApiProperty({ description: 'Datum isteka', required: false })
  expiresAt?: Date;

  @ApiProperty({ description: 'Poslednje korišćenje', required: false })
  lastUsedAt?: Date;

  @ApiProperty({
    description: 'IP adresa poslednjeg korišćenja',
    required: false,
  })
  lastUsedIp?: string;

  @ApiProperty({ description: 'Broj korišćenja' })
  usageCount: number;

  @ApiProperty({ description: 'Da li je ključ aktivan' })
  isActive: boolean;

  @ApiProperty({ description: 'Datum revokovanja', required: false })
  revokedAt?: Date;

  @ApiProperty({ description: 'Razlog revokovanja', required: false })
  revokeReason?: string;

  @ApiProperty({ description: 'Kreirao (korisnik)', required: false })
  creator?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };

  @ApiProperty({ description: 'Revokovao (korisnik)', required: false })
  revoker?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };

  @ApiProperty({ description: 'Datum kreiranja' })
  createdAt: Date;

  @ApiProperty({ description: 'Datum ažuriranja' })
  updatedAt: Date;
}

export class CreateApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({
    description: 'Ceo API ključ - prikazuje se samo jednom pri kreiranju!',
    example: 'sk_prod_swagger_xY3mN9pQ2rS5tU8vW1aB2cD3',
  })
  key: string;
}

export class ApiKeyLogResponseDto {
  @ApiProperty({ description: 'ID log zapisa' })
  id: number;

  @ApiProperty({ description: 'ID API ključa' })
  apiKeyId: number;

  @ApiProperty({
    description: 'Akcija',
    example: 'access_granted',
    enum: [
      'access_granted',
      'access_denied',
      'key_validated',
      'key_created',
      'key_revoked',
    ],
  })
  action: string;

  @ApiProperty({ description: 'IP adresa', required: false })
  ipAddress?: string;

  @ApiProperty({ description: 'User agent', required: false })
  userAgent?: string;

  @ApiProperty({ description: 'Endpoint', required: false })
  endpoint?: string;

  @ApiProperty({ description: 'HTTP metod', required: false })
  method?: string;

  @ApiProperty({ description: 'HTTP status kod', required: false })
  responseCode?: number;

  @ApiProperty({ description: 'Vreme odziva u milisekundama', required: false })
  responseTime?: number;

  @ApiProperty({ description: 'Poruka greške', required: false })
  errorMessage?: string;

  @ApiProperty({ description: 'Datum i vreme' })
  createdAt: Date;
}
