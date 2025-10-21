import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TimetableSchedulesService } from './timetable-schedules.service';
import { QueryTimetableSchedulesDto } from './dto/query-timetable-schedules.dto';
import { SyncTimetableSchedulesDto } from './dto/sync-timetable-schedules.dto';
import { MainSchedulesResponseDto } from './dto/main-schedules-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Timetable Schedules')
@Controller('timetable-schedules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TimetableSchedulesController {
  constructor(
    private readonly timetableSchedulesService: TimetableSchedulesService,
  ) {}

  // ========== GLAVNI SERVER ENDPOINTS (LOKALNI MYSQL) ==========

  @Get('main')
  @ApiOperation({
    summary: 'Lista sinhronizovanih linija sa Glavnog servera',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista linija sa statistikom sinhronizacije',
    type: MainSchedulesResponseDto,
  })
  @ApiQuery({ name: 'dateValidFrom', required: false, type: String })
  @RequirePermissions('transport.administration.timetable_sync.main:view')
  findAllMain(
    @Query('dateValidFrom') dateValidFrom?: string,
  ): Promise<MainSchedulesResponseDto> {
    return this.timetableSchedulesService.findAllMain(dateValidFrom);
  }

  // ========== TIKETING SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('ticketing/vremena-polaska')
  @ApiOperation({
    summary: 'Vremena polaska sa Tiketing servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista vremena polaska' })
  @ApiQuery({ name: 'dateValidFrom', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.timetable_sync.ticketing:view')
  findAllVremenaPolaskaTicketing(@Query() query: QueryTimetableSchedulesDto) {
    return this.timetableSchedulesService.findAllVremenaPolaskaTicketing(
      query.dateValidFrom,
      query.page,
      query.limit,
    );
  }

  @Get('ticketing/vremena-polaska-st')
  @ApiOperation({
    summary: 'Vremena polaska stanice sa Tiketing servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista vremena polaska stanice' })
  @ApiQuery({ name: 'dateValidFrom', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.timetable_sync.ticketing:view')
  findAllVremenaPolaskaStTicketing(
    @Query() query: QueryTimetableSchedulesDto,
  ) {
    return this.timetableSchedulesService.findAllVremenaPolaskaStTicketing(
      query.dateValidFrom,
      query.page,
      query.limit,
    );
  }

  @Post('sync-ticketing')
  @ApiOperation({
    summary: 'Sinhronizacija RedVoznje sa Tiketing servera',
  })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija uspešno završena',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        vremenaPolaska: {
          type: 'object',
          properties: {
            created: { type: 'number' },
            updated: { type: 'number' },
            skipped: { type: 'number' },
            errors: { type: 'number' },
            totalProcessed: { type: 'number' },
          },
        },
        vremenaPolaskaSt: {
          type: 'object',
          properties: {
            created: { type: 'number' },
            updated: { type: 'number' },
            skipped: { type: 'number' },
            errors: { type: 'number' },
            totalProcessed: { type: 'number' },
          },
        },
        totalProcessed: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Legacy baza nije pronađena' })
  @ApiBody({ type: SyncTimetableSchedulesDto })
  @RequirePermissions('transport.administration.timetable_sync.ticketing:sync')
  async syncFromTicketing(
    @Body() dto: SyncTimetableSchedulesDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.id || 1;
    return this.timetableSchedulesService.syncAllFromTicketing(
      dto.dateValidFrom,
      userId,
    );
  }

  // ========== GRADSKI SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('city/vremena-polaska')
  @ApiOperation({
    summary: 'Vremena polaska sa Gradskog servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista vremena polaska' })
  @ApiQuery({ name: 'dateValidFrom', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.timetable_sync.city:view')
  findAllVremenaPolaskaCity(@Query() query: QueryTimetableSchedulesDto) {
    return this.timetableSchedulesService.findAllVremenaPolaskaCity(
      query.dateValidFrom,
      query.page,
      query.limit,
    );
  }

  @Get('city/vremena-polaska-st')
  @ApiOperation({
    summary: 'Vremena polaska stanice sa Gradskog servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista vremena polaska stanice' })
  @ApiQuery({ name: 'dateValidFrom', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.timetable_sync.city:view')
  findAllVremenaPolaskaStCity(@Query() query: QueryTimetableSchedulesDto) {
    return this.timetableSchedulesService.findAllVremenaPolaskaStCity(
      query.dateValidFrom,
      query.page,
      query.limit,
    );
  }

  @Post('sync-city')
  @ApiOperation({
    summary: 'Sinhronizacija RedVoznje sa Gradskog servera',
  })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija uspešno završena',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        vremenaPolaska: {
          type: 'object',
          properties: {
            created: { type: 'number' },
            updated: { type: 'number' },
            skipped: { type: 'number' },
            errors: { type: 'number' },
            totalProcessed: { type: 'number' },
          },
        },
        vremenaPolaskaSt: {
          type: 'object',
          properties: {
            created: { type: 'number' },
            updated: { type: 'number' },
            skipped: { type: 'number' },
            errors: { type: 'number' },
            totalProcessed: { type: 'number' },
          },
        },
        totalProcessed: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Legacy baza nije pronađena' })
  @ApiBody({ type: SyncTimetableSchedulesDto })
  @RequirePermissions('transport.administration.timetable_sync.city:sync')
  async syncFromCity(
    @Body() dto: SyncTimetableSchedulesDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.id || 1;
    return this.timetableSchedulesService.syncAllFromCity(
      dto.dateValidFrom,
      userId,
    );
  }
}
