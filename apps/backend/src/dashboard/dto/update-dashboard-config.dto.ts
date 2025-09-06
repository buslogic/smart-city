import { IsObject, IsOptional, IsString, IsNumber, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDashboardConfigDto {
  @ApiProperty({
    description: 'Dashboard konfiguracija',
    example: {
      layout: 'grid',
      columns: 3,
      gap: 16,
      theme: 'light',
    },
  })
  @IsObject()
  config: Record<string, any>;
}

export class ToggleWidgetDto {
  @ApiProperty({
    description: 'ID widget-a',
    example: 'vehicle-statistics',
  })
  @IsString()
  widgetId: string;

  @ApiProperty({
    description: 'Da li je widget omogućen',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;
}

export class ReorderWidgetsDto {
  @ApiProperty({
    description: 'Novi redosled widget-a',
    example: ['vehicle-statistics', 'gps-sync-status', 'user-statistics'],
  })
  @IsArray()
  @IsString({ each: true })
  widgetOrder: string[];
}

export class ResizeWidgetDto {
  @ApiProperty({
    description: 'ID widget-a',
    example: 'vehicle-statistics',
  })
  @IsString()
  widgetId: string;

  @ApiProperty({
    description: 'Širina widget-a (u grid jedinicama)',
    example: 2,
  })
  @IsNumber()
  width: number;

  @ApiProperty({
    description: 'Visina widget-a (u grid jedinicama)',
    example: 1,
  })
  @IsNumber()
  height: number;
}