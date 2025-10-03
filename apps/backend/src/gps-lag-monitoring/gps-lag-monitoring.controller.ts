import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { GpsLagMonitoringService } from './gps-lag-monitoring.service';

@ApiTags('GPS LAG Monitoring')
@Controller('gps-lag-monitoring')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class GpsLagMonitoringController {
  constructor(private readonly monitoringService: GpsLagMonitoringService) {}

  @Get('overview')
  @RequirePermissions('vehicles.gps.lag:view')
  @ApiOperation({ summary: 'Get GPS processing overview' })
  async getOverview() {
    return this.monitoringService.getProcessingOverview();
  }

  @Get('health-checks')
  @RequirePermissions('vehicles.gps.lag:view')
  @ApiOperation({ summary: 'Get system health checks' })
  async getHealthChecks() {
    return this.monitoringService.getHealthChecks();
  }

  @Get('vehicle-progress')
  @RequirePermissions('vehicles.gps.lag:view')
  @ApiOperation({ summary: 'Get vehicle processing progress' })
  async getVehicleProgress(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.monitoringService.getVehicleProgress(limitNum);
  }

  @Get('outlier-analysis')
  @RequirePermissions('vehicles.gps.lag:view')
  @ApiOperation({ summary: 'Get outlier analysis' })
  async getOutlierAnalysis(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.monitoringService.getOutlierAnalysis(limitNum);
  }

  @Get('hourly-rate')
  @RequirePermissions('vehicles.gps.lag:view')
  @ApiOperation({ summary: 'Get hourly processing rate' })
  async getHourlyRate() {
    return this.monitoringService.getHourlyProcessingRate();
  }

  @Get('recommendations')
  @RequirePermissions('vehicles.gps.lag:view')
  @ApiOperation({ summary: 'Get processing recommendations' })
  async getRecommendations() {
    return this.monitoringService.getRecommendations();
  }

  @Get('dashboard')
  @RequirePermissions('vehicles.gps.lag:view')
  @ApiOperation({ summary: 'Get all dashboard data' })
  async getDashboard() {
    return this.monitoringService.getDashboardData();
  }
}
