import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { GpsAnalyticsService } from './gps-analytics.service';
import {
  VehicleAnalyticsDto,
  VehicleAnalyticsQueryDto,
} from './dto/vehicle-analytics.dto';

@ApiTags('GPS Analytics')
@Controller('gps-analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class GpsAnalyticsController {
  constructor(private readonly gpsAnalyticsService: GpsAnalyticsService) {}

  @Get('vehicle')
  @ApiOperation({ summary: 'Dohvati analitiku za vozilo' })
  @RequirePermissions('dispatcher:view_analytics')
  async getVehicleAnalytics(
    @Query() query: VehicleAnalyticsQueryDto,
  ): Promise<VehicleAnalyticsDto> {
    return this.gpsAnalyticsService.getVehicleAnalytics(
      query.vehicleId,
      query.startDate,
      query.endDate,
    );
  }
}
