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
  Sse,
  MessageEvent,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { PlanningService } from './planning.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateMonthlyScheduleDto } from './dto/create-monthly-schedule.dto';
import { QueryScheduleDto, QueryTurnusiDto, QueryMonthlyScheduleDto } from './dto/query-schedule.dto';
import { GetDriversAvailabilityDto } from './dto/get-drivers-availability.dto';
import { GetTurageOptionsDto } from './dto/get-turage-options.dto';
import { GetTurnusLinkInfoDto } from './dto/get-turnus-link-info.dto';
import { MonthlyDriverReportQueryDto } from './dto/monthly-driver-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SseAuthGuard } from '../auth/guards/sse-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Planning')
@Controller('planning')
@ApiBearerAuth()
export class PlanningController {
  private readonly logger = new Logger(PlanningController.name);

  constructor(
    private readonly planningService: PlanningService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('lines')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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

  @Get('turage-options')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Dobavi dostupne turaže za odabranu liniju/turnus/smenu/dan',
    description:
      'Vraća listu dostupnih turaža (turage_no) za odabranu liniju, turnus, smenu i dan u nedelji (Subota/Nedelja). Koristi se za dropdown u Mesečnom tab-u.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista dostupnih turaža',
  })
  @ApiQuery({ name: 'lineNumber', required: true, type: String })
  @ApiQuery({ name: 'turnusName', required: true, type: String })
  @ApiQuery({ name: 'shiftNumber', required: true, type: Number })
  @ApiQuery({ name: 'dayOfWeek', required: true, enum: ['Subota', 'Nedelja'] })
  @RequirePermissions('transport.planning.schedule:view')
  async getTurageOptions(@Query() query: GetTurageOptionsDto) {
    return this.planningService.getTurageOptions(query);
  }

  @Get('turnus-link-info')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Dobavi informacije o linkovanom turnusu',
    description:
      'Proverava da li odabrani turnus ima linkovan par u turnus_linked tabeli. Ako ima, vraća informacije o linkovanom turnusu i hronološkom redosledu (sortiranom po start_time).',
  })
  @ApiResponse({
    status: 200,
    description: 'Informacije o linkovanom turnusu',
    schema: {
      example: {
        hasLink: true,
        linkedTurnus: {
          lineNumber: '18',
          turnusId: 123,
          turnusName: '00018-2',
          startTime: '12:30',
        },
        chronologicalOrder: {
          first: {
            lineNumber: '18',
            turnusId: 122,
            turnusName: '00018-1',
            startTime: '04:00',
          },
          second: {
            lineNumber: '18',
            turnusId: 123,
            turnusName: '00018-2',
            startTime: '12:30',
          },
        },
        isSelectedFirst: true,
      },
    },
  })
  @ApiQuery({ name: 'lineNumber', required: true, type: String })
  @ApiQuery({ name: 'turnusName', required: true, type: String })
  @ApiQuery({ name: 'shiftNumber', required: true, type: Number })
  @ApiQuery({ name: 'date', required: true, type: String })
  @RequirePermissions('transport.planning.schedule:view')
  async getTurnusLinkInfo(@Query() query: GetTurnusLinkInfoDto) {
    return this.planningService.getLinkedTurnusInfo(
      query.lineNumber,
      query.turnusName,
      query.shiftNumber,
      query.date,
    );
  }

  @Post('schedule')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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

  @Get('schedule/monthly')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Dobavi rasporede za ceo mesec i liniju',
    description:
      'Vraća sve isplanirane turnuse za odabrani mesec i liniju, grupisane po danima',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista rasporeda za mesec',
  })
  @ApiQuery({ name: 'month', required: true, type: Number, example: 10 })
  @ApiQuery({ name: 'year', required: true, type: Number, example: 2025 })
  @ApiQuery({ name: 'lineNumber', required: true, type: String, example: '18' })
  @RequirePermissions('transport.planning.schedule:view')
  async getMonthlySchedules(@Query() query: QueryMonthlyScheduleDto) {
    return this.planningService.getMonthlySchedulesByLine(query);
  }

  @Post('monthly-schedule')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Kreiraj mesečni raspored',
    description:
      'Kreira raspored za ceo mesec sa mogućnošću isključivanja specifičnih dana u nedelji',
  })
  @ApiResponse({
    status: 201,
    description: 'Mesečni raspored uspešno kreiran',
  })
  @RequirePermissions('transport.planning.schedule:create')
  async createMonthlySchedule(
    @Body() dto: CreateMonthlyScheduleDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.id || 1;
    return this.planningService.createMonthlySchedule(dto, userId);
  }

  @Sse('monthly-schedule-stream')
  @Public()
  @ApiOperation({
    summary: 'Kreiraj mesečni raspored sa real-time progress stream-om',
    description:
      'Server-Sent Events endpoint koji strimuje napredak kreiranja mesečnog rasporeda u realnom vremenu. Token se šalje kao query parametar (?token=xxx) jer EventSource ne podržava custom headers.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream sa progress updates',
  })
  createMonthlyScheduleStream(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('lineNumber') lineNumber: string,
    @Query('turnusName') turnusName: string,
    @Query('shiftNumber') shiftNumber: string,
    @Query('driverId') driverId: string,
    @Query('includedDaysOfWeek') includedDaysOfWeek: string,
    @Query('excludedDaysOfWeek') excludedDaysOfWeek: string,
    @Query('token') token: string,
    @Query('conflictResolution') conflictResolution?: string,
    @Query('saturdayTurnusName') saturdayTurnusName?: string,
    @Query('sundayTurnusName') sundayTurnusName?: string,
  ): Observable<MessageEvent> {
    this.logger.log('SSE endpoint pozvan - validacija tokena...');

    // Manuelna validacija JWT tokena
    let userId = 1; // default fallback
    try {
      if (!token) {
        this.logger.error('Token nije prosleđen u query parametrima');
        throw new UnauthorizedException('Token je obavezan');
      }

      // Verifikuj token
      const payload = this.jwtService.verify(token);
      userId = payload.sub;

      this.logger.log(`Token validiran uspešno, korisnik ID: ${userId}`);
    } catch (error) {
      this.logger.error('Greška pri validaciji tokena:', error.message);
      throw new UnauthorizedException('Nevažeći ili istekao token');
    }

    // Parsiranje parametara
    const dto: CreateMonthlyScheduleDto = {
      month: parseInt(month),
      year: parseInt(year),
      lineNumber,
      turnusName,
      shiftNumber: parseInt(shiftNumber),
      driverId: parseInt(driverId),
      includedDaysOfWeek: includedDaysOfWeek
        ? JSON.parse(includedDaysOfWeek)
        : [1, 2, 3, 4, 5],
      excludedDaysOfWeek: excludedDaysOfWeek
        ? JSON.parse(excludedDaysOfWeek)
        : [],
      conflictResolution: conflictResolution as any,
      saturdayTurnusName,
      sundayTurnusName,
    };

    this.logger.log('Pokrećem streaming za mesečni raspored...');
    return this.planningService.createMonthlyScheduleStream(dto, userId);
  }

  @Delete('schedule/:id/:startDate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
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

  @Delete('schedule/monthly/:id/:startDate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Obriši raspored za ceo mesec',
    description:
      'Briše sve rasporede za odabrani turnus i smenu u celom mesecu',
  })
  @ApiResponse({
    status: 200,
    description: 'Mesečni raspored uspešno obrisan',
  })
  @ApiQuery({ name: 'month', required: true, type: Number, example: 10 })
  @ApiQuery({ name: 'year', required: true, type: Number, example: 2025 })
  @ApiQuery({
    name: 'lineNumber',
    required: true,
    type: String,
    example: '18',
  })
  @ApiQuery({
    name: 'turnusName',
    required: true,
    type: String,
    example: '00018-1',
  })
  @ApiQuery({ name: 'shiftNumber', required: true, type: Number, example: 1 })
  @RequirePermissions('transport.planning.schedule:delete')
  async deleteMonthlySchedule(
    @Param('id') id: string,
    @Param('startDate') startDate: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('lineNumber') lineNumber: string,
    @Query('turnusName') turnusName: string,
    @Query('shiftNumber') shiftNumber: string,
  ) {
    return this.planningService.deleteMonthlySchedule({
      id: parseInt(id),
      startDate: new Date(startDate),
      month: parseInt(month),
      year: parseInt(year),
      lineNumber,
      turnusName,
      shiftNumber: parseInt(shiftNumber),
    });
  }

  @Get('monthly-driver-report')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiOperation({
    summary: 'Dobavi mesečni izveštaj vozača',
    description:
      'Vraća izveštaj svih vozača sa turnusima, linijama, smenama i slobodnim danima za odabrani mesec',
  })
  @ApiResponse({
    status: 200,
    description: 'Mesečni izveštaj vozača',
  })
  @ApiQuery({ name: 'month', required: true, type: Number, example: 11 })
  @ApiQuery({ name: 'year', required: true, type: Number, example: 2025 })
  @RequirePermissions('transport.planning.schedule_print:view')
  async getMonthlyDriverReport(@Query() query: MonthlyDriverReportQueryDto) {
    return this.planningService.getMonthlyDriverReport(
      query.month,
      query.year,
    );
  }
}
