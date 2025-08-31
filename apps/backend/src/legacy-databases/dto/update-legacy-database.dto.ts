import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateLegacyDatabaseDto } from './create-legacy-database.dto';

export class UpdateLegacyDatabaseDto extends PartialType(CreateLegacyDatabaseDto) {}

export class TestConnectionDto {
  @ApiProperty({ description: 'Host adresa baze podataka' })
  host: string;

  @ApiProperty({ description: 'Port baze podataka' })
  port: number;

  @ApiProperty({ description: 'Naziv baze podataka' })
  database: string;

  @ApiProperty({ description: 'Korisničko ime za pristup bazi' })
  username: string;

  @ApiProperty({ description: 'Lozinka za pristup bazi' })
  password: string;

  @ApiProperty({ 
    description: 'Tip baze podataka',
    enum: ['mysql', 'postgresql', 'mongodb', 'oracle', 'mssql']
  })
  type: string;
}