import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RecreationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum RecreationStrategy {
  DAILY = 'daily',
  BULK = 'bulk',
}

export class StartRecreationDto {
  @ApiProperty({
    type: [Number],
    description: 'Array of vehicle IDs to process',
  })
  @IsArray()
  @IsNumber({}, { each: true })
  vehicleIds: number[];

  @ApiProperty({ description: 'Start date for analysis (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date for analysis (YYYY-MM-DD)' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Clear existing events before recreation',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  clearExisting?: boolean;

  @ApiPropertyOptional({
    enum: RecreationStrategy,
    default: RecreationStrategy.DAILY,
  })
  @IsOptional()
  @IsEnum(RecreationStrategy)
  strategy?: RecreationStrategy;

  @ApiPropertyOptional({
    description: 'Notify user on completion',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  notifyOnComplete?: boolean;
}

export class VehicleProgressDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  garageNo: string;

  @ApiProperty({ enum: ['pending', 'processing', 'completed', 'error'] })
  status: string;

  @ApiProperty()
  progress: number;

  @ApiPropertyOptional()
  eventsDetected?: number;

  @ApiPropertyOptional()
  eventsBefore?: number;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional()
  processingTime?: number;
}

export class RecreationStatusDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ enum: RecreationStatus })
  status: RecreationStatus;

  @ApiProperty()
  totalVehicles: number;

  @ApiProperty()
  processedVehicles: number;

  @ApiPropertyOptional()
  currentVehicle?: {
    id: number;
    garageNo: string;
    progress: number;
    eventsDetected: number;
  };

  @ApiProperty({ type: [VehicleProgressDto] })
  vehicles: VehicleProgressDto[];

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional()
  estimatedCompletion?: Date;

  @ApiProperty()
  totalEventsDetected: number;

  @ApiProperty()
  totalEventsBefore: number;
}

export class VehicleWithStatsDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  garageNo: string;

  @ApiProperty()
  registration: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  gpsPoints: number;

  @ApiProperty()
  existingEvents: number;
}

export class PreviewDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  vehicleIds: number[];

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;
}

export class RecreationHistoryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  userEmail: string;

  @ApiProperty({ type: [Number] })
  vehicleIds: number[];

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  totalVehicles: number;

  @ApiProperty()
  processedVehicles: number;

  @ApiProperty()
  totalEventsDetected: number;

  @ApiProperty()
  totalEventsBefore: number;

  @ApiProperty({ enum: RecreationStatus })
  status: RecreationStatus;

  @ApiProperty({ enum: RecreationStrategy })
  strategy: RecreationStrategy;

  @ApiProperty()
  clearExisting: boolean;

  @ApiPropertyOptional()
  startedAt?: Date | null;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  @ApiPropertyOptional()
  errorMessage?: string | null;

  @ApiProperty()
  createdAt: Date;
}
