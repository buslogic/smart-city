import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EventType {
  ACCELERATION = 'acceleration',
  BRAKING = 'braking',
  CORNERING = 'cornering',
}

export enum SeverityLevel {
  NORMAL = 'normal',
  MODERATE = 'moderate',
  SEVERE = 'severe',
}

export enum AggregateType {
  NO_POSTGIS = 'no_postgis', // Novi agregat БEZ PostGIS (brži, default)
  POSTGIS = 'postgis', // Stari agregat SA PostGIS (backup)
}

export class DrivingEventDto {
  @ApiProperty({ description: 'Event ID' })
  id: number;

  @ApiProperty({ description: 'Event timestamp' })
  time: Date;

  @ApiProperty({ description: 'Vehicle ID' })
  vehicleId: number;

  @ApiProperty({ description: 'Garage number' })
  garageNo: string;

  @ApiProperty({ enum: EventType, description: 'Type of driving event' })
  eventType: EventType;

  @ApiProperty({ enum: SeverityLevel, description: 'Severity of the event' })
  severity: SeverityLevel;

  @ApiProperty({ description: 'Acceleration value in m/s²' })
  accelerationValue: number;

  @ApiProperty({ description: 'G-force value' })
  gForce: number;

  @ApiProperty({ description: 'Speed before event (km/h)' })
  speedBefore: number;

  @ApiProperty({ description: 'Speed after event (km/h)' })
  speedAfter: number;

  @ApiProperty({ description: 'Event duration in milliseconds' })
  durationMs: number;

  @ApiProperty({ description: 'Distance covered during event (meters)' })
  distanceMeters: number;

  @ApiProperty({ description: 'Latitude' })
  lat: number;

  @ApiProperty({ description: 'Longitude' })
  lng: number;

  @ApiProperty({ description: 'Heading (0-360)', required: false })
  heading?: number;

  @ApiProperty({ description: 'Confidence level (0.0-1.0)' })
  confidence: number;
}

export class GetEventsQueryDto {
  @ApiProperty({ description: 'Start date (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    enum: SeverityLevel,
    required: false,
    description: 'Filter by severity',
  })
  @IsOptional()
  @IsEnum(SeverityLevel)
  severity?: SeverityLevel;

  @ApiProperty({
    enum: EventType,
    required: false,
    description: 'Filter by event type',
  })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiProperty({ description: 'Page number', default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', default: 50, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 50;
}

export class VehicleStatisticsDto {
  @ApiProperty({ description: 'Total number of events' })
  totalEvents: number;

  @ApiProperty({ description: 'Number of severe accelerations' })
  severeAccelerations: number;

  @ApiProperty({ description: 'Number of moderate accelerations' })
  moderateAccelerations: number;

  @ApiProperty({ description: 'Number of severe brakings' })
  severeBrakings: number;

  @ApiProperty({ description: 'Number of moderate brakings' })
  moderateBrakings: number;

  @ApiProperty({ description: 'Average G-force' })
  avgGForce: number;

  @ApiProperty({ description: 'Maximum G-force' })
  maxGForce: number;

  @ApiProperty({ description: 'Total distance in kilometers' })
  totalDistanceKm: number;

  @ApiProperty({ description: 'Events per 100km' })
  eventsPer100Km: number;

  @ApiProperty({ description: 'Most common hour for events' })
  mostCommonHour: number;

  @ApiProperty({ description: 'Safety score (0-100)' })
  safetyScore: number;

  @ApiProperty({ description: 'Period start date' })
  startDate: string;

  @ApiProperty({ description: 'Period end date' })
  endDate: string;

  @ApiProperty({ description: 'Vehicle ID' })
  vehicleId: number;

  @ApiProperty({ description: 'Garage number' })
  garageNo: string;
}

export class ChartDataPointDto {
  @ApiProperty({ description: 'Timestamp' })
  time: string;

  @ApiProperty({ description: 'Acceleration value in m/s²' })
  acceleration: number;

  @ApiProperty({ description: 'Speed in km/h' })
  speed: number;

  @ApiProperty({ description: 'Event type', required: false })
  eventType?: EventType;

  @ApiProperty({ description: 'Severity level', required: false })
  severity?: SeverityLevel;

  @ApiProperty({ description: 'G-force', required: false })
  gForce?: number;
}

export class ChartDataDto {
  @ApiProperty({ description: 'Vehicle ID' })
  vehicleId: number;

  @ApiProperty({ description: 'Garage number' })
  garageNo: string;

  @ApiProperty({ description: 'Start date' })
  startDate: string;

  @ApiProperty({ description: 'End date' })
  endDate: string;

  @ApiProperty({ type: [ChartDataPointDto], description: 'Chart data points' })
  dataPoints: ChartDataPointDto[];

  @ApiProperty({ description: 'Total data points' })
  totalPoints: number;

  @ApiProperty({ description: 'Number of events in this period' })
  eventCount: number;
}

export class BatchStatisticsDto {
  @ApiProperty({
    description: 'Array of vehicle IDs',
    example: [1, 2, 3, 4, 5],
    type: [Number],
  })
  @IsNumber({}, { each: true })
  vehicleIds: number[];

  @ApiProperty({
    description: 'Start date (YYYY-MM-DD)',
    example: '2025-08-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date (YYYY-MM-DD)',
    example: '2025-08-31',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    enum: AggregateType,
    description:
      'Aggregate type: no_postgis (БEZ PostGIS, brži, default) ili postgis (SA PostGIS, backup)',
    required: false,
    default: AggregateType.NO_POSTGIS,
  })
  @IsOptional()
  @IsEnum(AggregateType)
  aggregateType?: AggregateType;

  @ApiProperty({
    description:
      'Zaobiđi aggregate-e i računaj direktno iz gps_data tabele (najsporije, emergency)',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  useDirectCalculation?: boolean;
}
