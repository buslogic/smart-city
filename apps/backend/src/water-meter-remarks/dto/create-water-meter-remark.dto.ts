import { IsString, IsInt, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWaterMeterRemarkDto {
  @ApiProperty({ description: 'Očitanje vodomera', example: '-', default: '-' })
  @IsString()
  @IsNotEmpty()
  meterReading: string;

  @ApiProperty({ description: 'Neispravan vodomer', example: 0, default: 0 })
  @IsInt()
  faulty: number;

  @ApiProperty({ description: 'Neočitljiv vodomer', example: 0, default: 0 })
  @IsInt()
  unreadable: number;

  @ApiProperty({ description: 'Vodomer nije pronađen na licu mesta', example: 0, default: 0 })
  @IsInt()
  notFoundOnSite: number;

  @ApiProperty({ description: 'Nema vodomera', example: 0, default: 0 })
  @IsInt()
  noMeter: number;

  @ApiProperty({ description: 'Negativna potrošnja', example: 0, default: 0 })
  @IsInt()
  negativeConsumption: number;

  @ApiProperty({ description: 'Prenesi na sledeći ciklus', example: 0, default: 0 })
  @IsInt()
  transferToNextCl: number;

  @ApiProperty({ description: 'Štampanje računa', example: 0, default: 0 })
  @IsInt()
  billPrintout: number;

  @ApiPropertyOptional({ description: 'Napomena', example: 'Dodatna napomena' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Korisnički račun', example: '12345' })
  @IsString()
  @IsOptional()
  userAccount?: string;

  @ApiProperty({ description: 'Otkazan', example: 0, default: 0 })
  @IsInt()
  canceled: number;

  @ApiProperty({ description: 'Prioritet', example: 0, default: 0 })
  @IsInt()
  priority: number;

  @ApiProperty({ description: 'Prosek', example: 0, default: 0 })
  @IsInt()
  average: number;

  @ApiProperty({ description: 'Samo očitač vodomera', example: 0, default: 0 })
  @IsInt()
  meterReaderOnly: number;

  @ApiProperty({ description: 'Isključen', example: 0, default: 0 })
  @IsInt()
  disconnected: number;

  @ApiProperty({ description: 'Izbor cenzusa', example: 0, default: 0 })
  @IsInt()
  censusSelect: number;

  @ApiPropertyOptional({ description: 'Dostupnost', example: 'Dostupan' })
  @IsString()
  @IsOptional()
  availability?: string;
}
