import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class VehicleAnalyticsQueryDto {
  @ApiProperty({ description: 'ID vozila' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vehicleId: number;

  @ApiProperty({ description: 'Početni datum (ISO 8601)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Krajnji datum (ISO 8601)' })
  @IsDateString()
  endDate: string;
}

export class HourlyDataDto {
  @ApiProperty({ description: 'Sat (00-23)' })
  hour: string;

  @ApiProperty({ description: 'Pređena kilometraža' })
  distance: number;

  @ApiProperty({ description: 'Prosečna brzina' })
  avgSpeed: number;

  @ApiProperty({ description: 'Broj GPS tačaka' })
  points: number;
}

export class SpeedDistributionDto {
  @ApiProperty({ description: 'Opseg brzine' })
  range: string;

  @ApiProperty({ description: 'Broj merenja' })
  count: number;

  @ApiProperty({ description: 'Procenat' })
  percentage: number;
}

export class DailyStatsDto {
  @ApiProperty({ description: 'Datum' })
  date: string;

  @ApiProperty({ description: 'Kilometraža' })
  distance: number;

  @ApiProperty({ description: 'Sati vožnje' })
  drivingHours: number;

  @ApiProperty({ description: 'Prosečna brzina' })
  avgSpeed: number;
}

export class DrivingEventStatsDto {
  @ApiProperty({ description: 'Nivo ozbiljnosti (1-5)' })
  severity: number;

  @ApiProperty({ description: 'Opis nivoa' })
  label: string;

  @ApiProperty({ description: 'Broj događaja' })
  count: number;

  @ApiProperty({ description: 'Broj naglog kočenja' })
  harshBraking: number;

  @ApiProperty({ description: 'Broj naglog ubrzanja' })
  harshAcceleration: number;
}

export class VehicleAnalyticsDto {
  @ApiProperty({ description: 'Ukupan broj GPS tačaka' })
  totalPoints: number;

  @ApiProperty({ description: 'Ukupna pređena kilometraža (km)' })
  totalDistance: number;

  @ApiProperty({ description: 'Prosečna brzina (km/h)' })
  avgSpeed: number;

  @ApiProperty({ description: 'Maksimalna brzina (km/h)' })
  maxSpeed: number;

  @ApiProperty({ description: 'Sati vožnje' })
  drivingHours: number;

  @ApiProperty({ description: 'Vreme mirovanja (sati)' })
  idleTime: number;

  @ApiProperty({ description: 'Broj zaustavljanja' })
  totalStops: number;

  @ApiProperty({ description: 'Efikasnost (0-100%)' })
  efficiency: number;

  @ApiProperty({ type: [HourlyDataDto], description: 'Podaci po satima' })
  hourlyData: HourlyDataDto[];

  @ApiProperty({
    type: [SpeedDistributionDto],
    description: 'Distribucija brzine',
  })
  speedDistribution: SpeedDistributionDto[];

  @ApiProperty({ type: [DailyStatsDto], description: 'Dnevna statistika' })
  dailyStats: DailyStatsDto[];

  @ApiProperty({
    type: [DrivingEventStatsDto],
    description: 'Statistika agresivne vožnje',
  })
  drivingEventStats: DrivingEventStatsDto[];

  @ApiProperty({ description: 'Safety Score (0-100)' })
  safetyScore: number;
}
