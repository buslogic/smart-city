import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { DashboardConfigService } from './dashboard-config.service';
import { DashboardWidgetsService } from './dashboard-widgets.service';
import { UpdateDashboardConfigDto, ToggleWidgetDto } from './dto/update-dashboard-config.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(
    private readonly configService: DashboardConfigService,
    private readonly widgetsService: DashboardWidgetsService,
  ) {}

  // Debug endpoint - proverimo koje permisije korisnik ima (za development)
  @Get('debug/permissions')
  @UseGuards(JwtAuthGuard)
  async debugPermissions(@Request() req) {
    console.log('=== DEBUG PERMISSIONS ===');
    console.log('User:', req.user?.email);
    console.log('User ID:', req.user?.id);
    console.log('Roles:', req.user?.roles);
    console.log('Permissions:', req.user?.permissions);
    console.log('========================');
    return {
      email: req.user?.email,
      roles: req.user?.roles,
      permissions: req.user?.permissions,
    };
  }

  @Get('config')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Dobavi konfiguraciju dashboard-a za trenutnog korisnika' })
  @ApiResponse({ status: 200, description: 'Konfiguracija uspešno dobijena' })
  async getUserDashboardConfig(@Request() req) {
    return this.configService.getUserConfig(req.user.id);
  }

  @Put('config')
  @RequirePermissions('dashboard.update')
  @ApiOperation({ summary: 'Ažuriraj konfiguraciju dashboard-a za trenutnog korisnika' })
  @ApiResponse({ status: 200, description: 'Konfiguracija uspešno ažurirana' })
  async updateUserDashboardConfig(
    @Request() req,
    @Body() updateDto: UpdateDashboardConfigDto,
  ) {
    return this.configService.updateUserConfig(req.user.id, updateDto);
  }

  @Get('widgets/available')
  @RequirePermissions('dashboard.view')
  @ApiOperation({ summary: 'Dobavi listu dostupnih widget-a za korisnika' })
  @ApiResponse({ status: 200, description: 'Lista dostupnih widget-a' })
  async getAvailableWidgets(@Request() req) {
    return this.widgetsService.getAvailableWidgets(req.user);
  }

  @Get('widgets/vehicle-statistics')
  @RequirePermissions('dashboard.widgets.vehicles.view')
  @ApiOperation({ summary: 'Dobavi statistike vozila za dashboard widget' })
  @ApiResponse({ status: 200, description: 'Statistike vozila' })
  async getVehicleStatistics() {
    return this.widgetsService.getVehicleStatistics();
  }

  @Post('widgets/toggle')
  @RequirePermissions('dashboard.update')
  @ApiOperation({ summary: 'Uključi/isključi widget za korisnika' })
  @ApiResponse({ status: 200, description: 'Widget status ažuriran' })
  async toggleWidget(
    @Request() req,
    @Body() toggleDto: ToggleWidgetDto,
  ) {
    return this.configService.toggleWidget(
      req.user.id,
      toggleDto.widgetId,
      toggleDto.enabled,
    );
  }
}