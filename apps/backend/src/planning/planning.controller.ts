import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PlanningService } from './planning.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { QueryScheduleDto, QueryTurnusiDto } from './dto/query-schedule.dto';
import { GetDriversAvailabilityDto } from './dto/get-drivers-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Planning')
@Controller('planning')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get('lines')
  @ApiOperation({
    summary: 'Dobavi sve linije za dropdown',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista linija',
  })
  @RequirePermissions('transport.planning.schedule:view')
  async getLines() {
    return this.planningService.getLines();
  }

  @Get('turnusi')
  @ApiOperation({
    summary: 'Dobavi turnuse po liniji i datumu',
    description:
      'Filtrira turnuse koji saobraćaju na odabranoj liniji u dan u nedelji izračunat iz datuma',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista turnusa sa smenama',
  })
  @ApiQuery({ name: 'lineNumber', required: true, type: String })
  @ApiQuery({ name: 'date', required: true, type: String })
  @RequirePermissions('transport.planning.schedule:view')
  async getTurnusi(@Query() query: QueryTurnusiDto) {
    return this.planningService.getTurnusiByLineAndDate(
      query.lineNumber,
      query.date,
    );
  }

  @Get('drivers')
  @ApiOperation({
    summary: 'Dobavi sve vozače',
    description: 'Lista korisnika koji pripadaju grupi vozača (driver = true)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista vozača',
  })
  @RequirePermissions('transport.planning.schedule:view')
  async getDrivers() {
    return this.planningService.getDrivers();
  }

  @Get('drivers-availability')
  @ApiOperation({
    summary: 'Dobavi dostupnost vozača za odabrani turnus i smenu',
    description:
      'Vraća sve vozače sa njihovim već isplaniranim smenama za odabrani datum. Frontend primenjuje filtere da odredi ko je slobodan.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista vozača sa informacijama o dostupnosti',
  })
  @ApiQuery({ name: 'date', required: true, type: String })
  @ApiQuery({ name: 'lineNumber', required: true, type: String })
  @ApiQuery({ name: 'turnusId', required: true, type: Number })
  @ApiQuery({ name: 'shiftNumber', required: true, type: Number })
  @RequirePermissions('transport.planning.schedule:view')
  async getDriversAvailability(@Query() query: GetDriversAvailabilityDto) {
    return this.planningService.getDriversAvailability(query);
  }

  @Post('schedule')
  @ApiOperation({
    summary: 'Kreiraj novi raspored',
  })
  @ApiResponse({
    status: 201,
    description: 'Raspored uspešno kreiran',
  })
  @RequirePermissions('transport.planning.schedule:create')
  async createSchedule(
    @Body() dto: CreateScheduleDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.id || 1;
    return this.planningService.createSchedule(dto, userId);
  }

  @Get('schedule')
  @ApiOperation({
    summary: 'Dobavi rasporede za odabrani datum',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista rasporeda',
  })
  @ApiQuery({ name: 'date', required: true, type: String })
  @RequirePermissions('transport.planning.schedule:view')
  async getSchedules(@Query() query: QueryScheduleDto) {
    if (!query.date) {
      return [];
    }
    return this.planningService.getSchedulesByDate(query.date);
  }

  @Delete('schedule/:id/:startDate')
  @ApiOperation({
    summary: 'Obriši raspored',
  })
  @ApiResponse({
    status: 200,
    description: 'Raspored uspešno obrisan',
  })
  @RequirePermissions('transport.planning.schedule:delete')
  async deleteSchedule(
    @Param('id') id: string,
    @Param('startDate') startDate: string,
  ) {
    return this.planningService.deleteSchedule(
      parseInt(id),
      new Date(startDate),
    );
  }
}
