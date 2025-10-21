import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TimetableDatesService } from './timetable-dates.service';
import { CreateTimetableDateDto } from './dto/create-timetable-date.dto';
import { UpdateTimetableDateDto } from './dto/update-timetable-date.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Timetable Dates')
@Controller('timetable-dates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TimetableDatesController {
  constructor(private readonly timetableDatesService: TimetableDatesService) {}

  // ========== GLAVNI SERVER ENDPOINTS ==========

  @Post()
  @ApiOperation({
    summary: 'Kreiranje nove grupe za RedVoznje (Glavni server)',
  })
  @ApiResponse({
    status: 201,
    description: 'Grupa za RedVoznje uspešno kreirana',
  })
  @RequirePermissions('transport.administration.timetable_dates.main:create')
  create(@Body() createTimetableDateDto: CreateTimetableDateDto) {
    return this.timetableDatesService.create(createTimetableDateDto);
  }

  @Get('main')
  @ApiOperation({ summary: 'Sve grupe za RedVoznje sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Lista grupa za RedVoznje' })
  @RequirePermissions('transport.administration.timetable_dates.main:view')
  findAllMain() {
    return this.timetableDatesService.findAllMain();
  }

  @Get('main/:id')
  @ApiOperation({ summary: 'Jedna grupa za RedVoznje sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Detalji grupe za RedVoznje' })
  @ApiResponse({
    status: 404,
    description: 'Grupa za RedVoznje nije pronađena',
  })
  @RequirePermissions('transport.administration.timetable_dates.main:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.timetableDatesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriranje grupe za RedVoznje (Glavni server)' })
  @ApiResponse({
    status: 200,
    description: 'Grupa za RedVoznje uspešno ažurirana',
  })
  @ApiResponse({
    status: 404,
    description: 'Grupa za RedVoznje nije pronađena',
  })
  @RequirePermissions('transport.administration.timetable_dates.main:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTimetableDateDto: UpdateTimetableDateDto,
  ) {
    return this.timetableDatesService.update(id, updateTimetableDateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Brisanje grupe za RedVoznje (Glavni server)' })
  @ApiResponse({
    status: 200,
    description: 'Grupa za RedVoznje uspešno obrisana',
  })
  @ApiResponse({
    status: 404,
    description: 'Grupa za RedVoznje nije pronađena',
  })
  @RequirePermissions('transport.administration.timetable_dates.main:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.timetableDatesService.remove(id);
  }

  // ========== TIKETING SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('ticketing')
  @ApiOperation({
    summary: 'Sve grupe za RedVoznje sa Tiketing servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista grupa za RedVoznje' })
  @RequirePermissions('transport.administration.timetable_dates.ticketing:view')
  findAllTicketing() {
    return this.timetableDatesService.findAllTicketing();
  }

  @Post('sync-ticketing')
  @ApiOperation({
    summary: 'Sinhronizacija grupa za RedVoznje sa Tiketing servera',
  })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija uspešno završena',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        created: { type: 'number' },
        updated: { type: 'number' },
        skipped: { type: 'number' },
        errors: { type: 'number' },
        totalProcessed: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Legacy baza nije pronađena' })
  @RequirePermissions('transport.administration.timetable_dates.ticketing:sync')
  async syncFromTicketing(@Req() req: Request) {
    const userId = (req.user as any)?.id || 1;
    return this.timetableDatesService.syncFromTicketing(userId);
  }

  // ========== GRADSKI SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('city')
  @ApiOperation({
    summary: 'Sve grupe za RedVoznje sa Gradskog servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista grupa za RedVoznje' })
  @RequirePermissions('transport.administration.timetable_dates.city:view')
  findAllCity() {
    return this.timetableDatesService.findAllCity();
  }

  @Post('sync-city')
  @ApiOperation({
    summary: 'Sinhronizacija grupa za RedVoznje sa Gradskog servera',
  })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija uspešno završena',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        created: { type: 'number' },
        updated: { type: 'number' },
        skipped: { type: 'number' },
        errors: { type: 'number' },
        totalProcessed: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Legacy baza nije pronađena' })
  @RequirePermissions('transport.administration.timetable_dates.city:sync')
  async syncFromCity(@Req() req: Request) {
    const userId = (req.user as any)?.id || 1;
    return this.timetableDatesService.syncFromCity(userId);
  }
}
