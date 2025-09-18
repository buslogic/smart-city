import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class CreateLegacyDatabaseDto {
  @ApiProperty({ description: 'Naziv legacy baze podataka' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Tip baze podataka',
    enum: ['mysql', 'postgresql', 'mongodb', 'oracle', 'mssql'],
  })
  @IsString()
  @IsIn(['mysql', 'postgresql', 'mongodb', 'oracle', 'mssql'])
  type: string;

  @ApiProperty({
    description: 'Podvrsta legacy baze',
    enum: [
      'main_ticketing_database',
      'gps_ticketing_database',
      'global_ticketing_database',
      'city_ticketing_database',
      'city_gps_ticketing_database',
    ],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'main_ticketing_database',
    'gps_ticketing_database',
    'global_ticketing_database',
    'city_ticketing_database',
    'city_gps_ticketing_database',
  ])
  subtype?: string;

  @ApiProperty({ description: 'Host adresa baze podataka' })
  @IsString()
  host: string;

  @ApiProperty({
    description: 'Port baze podataka',
    minimum: 1,
    maximum: 65535,
  })
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ description: 'Naziv baze podataka' })
  @IsString()
  database: string;

  @ApiProperty({ description: 'Korisničko ime za pristup bazi' })
  @IsString()
  username: string;

  @ApiProperty({ description: 'Lozinka za pristup bazi' })
  @IsString()
  password: string;

  @ApiProperty({ description: 'Da li je baza aktivna', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Opis baze podataka', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
