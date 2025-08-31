import { IsArray, IsOptional, IsString, ValidateNested, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class GpsPointDto {
  @ApiProperty({ description: 'Garažni broj vozila', example: 'P21001' })
  @IsString()
  garageNo: string;

  @ApiProperty({ description: 'Geografska širina', example: 44.8125 })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: 'Geografska dužina', example: 20.4489 })
  @IsNumber()
  lng: number;

  @ApiProperty({ description: 'Brzina u km/h', example: 45 })
  @IsNumber()
  speed: number;

  @ApiProperty({ description: 'Kurs/pravac (0-360)', example: 180 })
  @IsNumber()
  course: number;

  @ApiProperty({ description: 'Nadmorska visina', example: 120, required: false })
  @IsOptional()
  @IsNumber()
  alt?: number;

  @ApiProperty({ description: 'Status vozila', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  state?: number;

  @ApiProperty({ description: 'Da li je na ruti (0/1)', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  inRoute?: number;

  @ApiProperty({ description: 'Broj linije', example: '26', required: false })
  @IsOptional()
  @IsString()
  lineNumber?: string;

  @ApiProperty({ description: 'Smer (0/1)', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  direction?: number;

  @ApiProperty({ description: 'ID polaska', required: false })
  @IsOptional()
  @IsNumber()
  departureId?: number;

  @ApiProperty({ description: 'Broj putnika koji su ušli', required: false })
  @IsOptional()
  @IsNumber()
  peopleIn?: number;

  @ApiProperty({ description: 'Broj putnika koji su izašli', required: false })
  @IsOptional()
  @IsNumber()
  peopleOut?: number;

  @ApiProperty({ description: 'Status baterije', required: false })
  @IsOptional()
  @IsNumber()
  batteryStatus?: number;

  @ApiProperty({ description: 'Vreme GPS očitavanja', example: '2024-01-15T10:30:00Z' })
  @IsDateString()
  captured: string;

  @ApiProperty({ description: 'Vreme poslednje izmene', example: '2024-01-15T10:30:01Z' })
  @IsDateString()
  edited: string;
}

export class GpsBatchDto {
  @ApiProperty({ 
    description: 'Niz GPS tačaka', 
    type: [GpsPointDto],
    isArray: true 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GpsPointDto)
  data: GpsPointDto[];

  @ApiProperty({ 
    description: 'Izvor podataka', 
    example: 'legacy',
    required: false 
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ 
    description: 'Timestamp batch-a', 
    example: '2024-01-15T10:30:00Z',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;
}