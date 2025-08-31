import { Controller, Get, Param, Query, ParseIntPipe, ValidationPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DrivingBehaviorService } from './driving-behavior.service';
import {
  DrivingEventDto,
  GetEventsQueryDto,
  VehicleStatisticsDto,
  ChartDataDto,
} from './dto/driving-events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Driving Behavior')
@Controller('driving-behavior')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DrivingBehaviorController {
  constructor(private readonly drivingBehaviorService: DrivingBehaviorService) {}

  /**
   * Get aggressive driving events for a specific vehicle
   */
  @Get('vehicle/:id/events')
  @ApiOperation({ 
    summary: 'Get driving events for a vehicle',
    description: 'Returns paginated list of aggressive driving events (acceleration, braking) for a specific vehicle'
  })
  @ApiParam({ name: 'id', description: 'Vehicle ID', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'List of driving events',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: { $ref: '#/components/schemas/DrivingEventDto' }
        },
        total: { type: 'number' }
      }
    }
  })
  async getVehicleEvents(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } })) query: GetEventsQueryDto,
  ): Promise<{ events: DrivingEventDto[]; total: number }> {
    return this.drivingBehaviorService.getVehicleEvents(vehicleId, query);
  }

  /**
   * Get driving statistics for a specific vehicle
   */
  @Get('vehicle/:id/statistics')
  @ApiOperation({ 
    summary: 'Get driving statistics for a vehicle',
    description: 'Returns aggregated statistics including safety score, event counts, and averages'
  })
  @ApiParam({ name: 'id', description: 'Vehicle ID', type: Number })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)', type: String })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)', type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'Vehicle driving statistics',
    type: VehicleStatisticsDto,
  })
  async getVehicleStatistics(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<VehicleStatisticsDto> {
    return this.drivingBehaviorService.getVehicleStatistics(vehicleId, startDate, endDate);
  }

  /**
   * Get chart data for vehicle acceleration/braking visualization
   */
  @Get('vehicle/:id/chart-data')
  @ApiOperation({ 
    summary: 'Get chart data for a vehicle',
    description: 'Returns time-series data for acceleration/braking chart visualization'
  })
  @ApiParam({ name: 'id', description: 'Vehicle ID', type: Number })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)', type: String })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)', type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'Chart data for visualization',
    type: ChartDataDto,
  })
  async getVehicleChartData(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ChartDataDto> {
    return this.drivingBehaviorService.getVehicleChartData(vehicleId, startDate, endDate);
  }
}
