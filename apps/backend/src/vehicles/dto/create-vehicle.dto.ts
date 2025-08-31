import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsBoolean, IsOptional, IsDateString, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ description: 'Legacy ID iz originalne baze', required: false })
  @IsOptional()
  @IsInt()
  legacyId?: number;

  @ApiProperty({ description: 'Garažni broj vozila', example: 'P80123' })
  @IsNotEmpty()
  @IsString()
  garageNumber: string;

  @ApiProperty({ description: 'Registarska oznaka', example: 'BG-123-AB', required: false })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiProperty({ description: 'Broj vozila', example: '123', required: false })
  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @ApiProperty({ description: 'Tip vozila (ID)', example: 110, required: false })
  @IsOptional()
  @IsInt()
  vehicleType?: number;

  @ApiProperty({ description: 'Brend vozila (ID)', example: 1, required: false })
  @IsOptional()
  @IsInt()
  vehicleBrand?: number;

  @ApiProperty({ description: 'Model vozila (ID)', example: 1, required: false })
  @IsOptional()
  @IsInt()
  vehicleModel?: number;

  @ApiProperty({ description: 'Broj šasije', required: false })
  @IsOptional()
  @IsString()
  chassisNumber?: string;

  @ApiProperty({ description: 'Broj motora', required: false })
  @IsOptional()
  @IsString()
  motorNumber?: string;

  @ApiProperty({ description: 'Godina proizvodnje', required: false })
  @IsOptional()
  @IsDateString()
  yearOfManufacture?: string;

  @ApiProperty({ description: 'Broj sedišta', example: 35, default: 0 })
  @IsInt()
  @Min(0)
  @Max(100)
  seatCapacity: number = 0;

  @ApiProperty({ description: 'Broj mesta za stajanje', example: 65, default: 0 })
  @IsInt()
  @Min(0)
  @Max(200)
  standingCapacity: number = 0;

  @ApiProperty({ description: 'Ukupan kapacitet', example: 100, default: 0 })
  @IsInt()
  @Min(0)
  @Max(300)
  totalCapacity: number = 0;

  @ApiProperty({ description: 'Tip goriva (ID)', example: 2, required: false })
  @IsOptional()
  @IsInt()
  fuelType?: number;

  @ApiProperty({ description: 'Da li je vozilo aktivno', default: true })
  @IsBoolean()
  active: boolean = true;

  @ApiProperty({ description: 'Da li je vozilo vidljivo', default: true })
  @IsBoolean()
  visible: boolean = true;

  @ApiProperty({ description: 'Da li vozilo ima WiFi', default: false })
  @IsBoolean()
  wifi: boolean = false;

  @ApiProperty({ description: 'Da li vozilo ima klimu', default: false })
  @IsBoolean()
  airCondition: boolean = false;

  @ApiProperty({ description: 'Da li vozilo ima rampu za invalide', default: false })
  @IsBoolean()
  rampForDisabled: boolean = false;

  @ApiProperty({ description: 'Da li vozilo ima video nadzor', default: false })
  @IsBoolean()
  videoSystem: boolean = false;

  @ApiProperty({ description: 'Da li je vozilo niskopodno', default: false })
  @IsBoolean()
  lowFloor: boolean = false;

  @ApiProperty({ description: 'IMEI broj GPS uređaja', required: false })
  @IsOptional()
  @IsString()
  imei?: string;

  @ApiProperty({ description: 'IMEI Net broj', required: false })
  @IsOptional()
  @IsString()
  imeiNet?: string;

  @ApiProperty({ description: 'Model GPS uređaja', required: false })
  @IsOptional()
  @IsString()
  gpsModel?: string;

  @ApiProperty({ description: 'Datum početka tehničkog pregleda', required: false })
  @IsOptional()
  @IsDateString()
  technicalControlFrom?: string;

  @ApiProperty({ description: 'Datum isteka tehničkog pregleda', required: false })
  @IsOptional()
  @IsDateString()
  technicalControlTo?: string;

  @ApiProperty({ description: 'Datum isteka registracije', required: false })
  @IsOptional()
  @IsDateString()
  registrationValidTo?: string;

  @ApiProperty({ description: 'Datum prve registracije', required: false })
  @IsOptional()
  @IsDateString()
  firstRegistrationDate?: string;

  @ApiProperty({ description: 'ID centralnog punkta', required: false })
  @IsOptional()
  @IsInt()
  centralPointId?: number;

  @ApiProperty({ description: 'Naziv centralnog punkta', required: false })
  @IsOptional()
  @IsString()
  centralPointName?: string;

  @ApiProperty({ description: 'Napomena', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: 'URL slike vozila', required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}