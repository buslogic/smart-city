import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DrivingBehaviorService } from './driving-behavior.service';
import {
  BatchStatisticsDto,
  DrivingEventDto,
  GetEventsQueryDto,
  VehicleStatisticsDto,
  ChartDataDto,
} from './dto/driving-events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Driving Behavior')
@Controller('driving-behavior')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DrivingBehaviorController {
  constructor(
    private readonly drivingBehaviorService: DrivingBehaviorService,
  ) {}

  /**
   * Get aggressive driving events for a specific vehicle
   */
  @Get('vehicle/:id/events')
  @ApiOperation({
    summary: 'Get driving events for a vehicle',
    description:
      'Returns paginated list of aggressive driving events (acceleration, braking) for a specific vehicle',
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
          items: { $ref: '#/components/schemas/DrivingEventDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  async getVehicleEvents(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    query: GetEventsQueryDto,
  ): Promise<{ events: DrivingEventDto[]; total: number }> {
    return this.drivingBehaviorService.getVehicleEvents(vehicleId, query);
  }

  /**
   * Get driving statistics for a specific vehicle
   */
  @Get('vehicle/:id/statistics')
  @ApiOperation({
    summary: 'Get driving statistics for a vehicle',
    description:
      'Returns aggregated statistics including safety score, event counts, and averages',
  })
  @ApiParam({ name: 'id', description: 'Vehicle ID', type: Number })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (YYYY-MM-DD)',
    type: String,
  })
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
    return this.drivingBehaviorService.getVehicleStatistics(
      vehicleId,
      startDate,
      endDate,
    );
  }

  /**
   * Get chart data for vehicle acceleration/braking visualization
   */
  @Get('vehicle/:id/chart-data')
  @ApiOperation({
    summary: 'Get chart data for a vehicle',
    description:
      'Returns time-series data for acceleration/braking chart visualization',
  })
  @ApiParam({ name: 'id', description: 'Vehicle ID', type: Number })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
    type: String,
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (YYYY-MM-DD)',
    type: String,
  })
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
    return this.drivingBehaviorService.getVehicleChartData(
      vehicleId,
      startDate,
      endDate,
    );
  }

  /**
   * OPTIMIZED: Get statistics for multiple vehicles at once
   * DUAL MODE: Supports both VIEW aggregates (fast) and direct calculation (reliable)
   */
  @Post('batch-statistics')
  @ApiOperation({
    summary: 'Get statistics for multiple vehicles (BATCH)',
    description:
      'Returns aggregated statistics for multiple vehicles in a single request - optimized for monthly reports. ' +
      'Supports dual mode: VIEW aggregates (fast, default) or direct calculation from gps_data (slower but reliable).',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of vehicle statistics',
    type: [VehicleStatisticsDto],
  })
  async getBatchStatistics(
    @Body() dto: BatchStatisticsDto,
  ): Promise<VehicleStatisticsDto[]> {
    return this.drivingBehaviorService.getBatchMonthlyStatistics(
      dto.vehicleIds,
      dto.startDate,
      dto.endDate,
      dto.useDirectCalculation ?? false,
    );
  }

  /**
   * Get safety score configuration
   */
  @Get('safety-config')
  @ApiOperation({
    summary: 'Get safety score configuration',
    description: 'Returns current safety score calculation parameters',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully',
  })
  async getSafetyConfig() {
    return this.drivingBehaviorService.getSafetyScoreConfig();
  }

  /**
   * Update safety score configuration
   */
  @Put('safety-config')
  @ApiOperation({
    summary: 'Update safety score configuration',
    description: 'Updates safety score calculation parameters',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        configs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              thresholdEvents: { type: 'number' },
              thresholdDistanceKm: { type: 'number' },
              penaltyPoints: { type: 'number' },
              penaltyMultiplier: { type: 'number' },
              maxPenalty: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
  })
  async updateSafetyConfig(@Body() dto: any, @CurrentUser() user: any) {
    return this.drivingBehaviorService.updateSafetyScoreConfig(
      dto.configs,
      user.id,
    );
  }

  /**
   * EMERGENCY: Force refresh continuous aggregates (LIVE SERVER)
   */
  @Post('force-refresh-aggregates')
  @ApiOperation({
    summary: 'EMERGENCY: Force refresh continuous aggregates',
    description:
      'Manually refresh all continuous aggregates - use only if needed on live server',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregates refreshed successfully',
  })
  async forceRefreshAggregates(@CurrentUser() user: any) {
    return this.drivingBehaviorService.forceRefreshContinuousAggregates(
      user.id,
    );
  }
}
