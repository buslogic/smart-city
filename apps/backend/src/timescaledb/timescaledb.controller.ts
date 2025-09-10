import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { TimescaledbService } from './timescaledb.service';

@ApiTags('TimescaleDB')
@ApiBearerAuth()
@Controller('timescaledb')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TimescaledbController {
  constructor(private readonly timescaledbService: TimescaledbService) {}

  @Get('tables')
  @RequirePermissions('maintenance.timescaledb:view')
  @ApiOperation({ summary: 'Dobavi listu svih tabela iz TimescaleDB' })
  @ApiResponse({ status: 200, description: 'Lista tabela uspešno dobijena' })
  @ApiResponse({ status: 403, description: 'Nemate permisiju za pristup' })
  async getTables() {
    return this.timescaledbService.getTables();
  }

  @Get('continuous-aggregates')
  @RequirePermissions('maintenance.timescaledb:view')
  @ApiOperation({ summary: 'Dobavi listu svih continuous aggregates' })
  @ApiResponse({ status: 200, description: 'Lista aggregates uspešno dobijena' })
  @ApiResponse({ status: 403, description: 'Nemate permisiju za pristup' })
  async getContinuousAggregates() {
    return this.timescaledbService.getContinuousAggregates();
  }

  @Get('tables/:schema/:table/statistics')
  @RequirePermissions('maintenance.timescaledb:view')
  @ApiOperation({ summary: 'Dobavi statistike za specifičnu tabelu' })
  @ApiResponse({ status: 200, description: 'Statistike uspešno dobijene' })
  @ApiResponse({ status: 403, description: 'Nemate permisiju za pristup' })
  @ApiResponse({ status: 404, description: 'Tabela nije pronađena' })
  async getTableStatistics(
    @Param('schema') schema: string,
    @Param('table') table: string,
  ) {
    return this.timescaledbService.getTableStatistics(schema, table);
  }

  @Post('continuous-aggregates/:name/refresh')
  @RequirePermissions('maintenance.timescaledb:manage')
  @ApiOperation({ summary: 'Ručno osveži continuous aggregate' })
  @ApiResponse({ status: 200, description: 'Aggregate uspešno osvežen' })
  @ApiResponse({ status: 403, description: 'Nemate permisiju za ovu akciju' })
  @ApiResponse({ status: 400, description: 'Neispravni parametri' })
  async refreshContinuousAggregate(
    @Param('name') name: string,
    @Body() body?: { startTime?: string; endTime?: string },
  ) {
    return this.timescaledbService.refreshContinuousAggregate(name, body?.startTime, body?.endTime);
  }
}