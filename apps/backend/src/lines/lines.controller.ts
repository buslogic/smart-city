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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { LinesService } from './lines.service';
import { CreateLineDto } from './dto/create-line.dto';
import { UpdateLineDto } from './dto/update-line.dto';
import { QueryLinesDto } from './dto/query-lines.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Lines')
@Controller('lines')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class LinesController {
  constructor(private readonly linesService: LinesService) {}

  // ========== GLAVNI SERVER ENDPOINTS ==========

  @Post()
  @ApiOperation({ summary: 'Kreiranje nove linije (Glavni server)' })
  @ApiResponse({ status: 201, description: 'Linija uspešno kreirana' })
  @RequirePermissions('transport.administration.lines.main:create')
  create(@Body() createLineDto: CreateLineDto) {
    return this.linesService.create(createLineDto);
  }

  @Get('main')
  @ApiOperation({ summary: 'Sve linije sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Lista linija' })
  @ApiQuery({ name: 'dateValidFrom', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.lines.main:view')
  findAllMain(@Query() query: QueryLinesDto) {
    return this.linesService.findAllMain(
      query.dateValidFrom,
      query.page,
      query.limit,
    );
  }

  @Get('main/:id')
  @ApiOperation({ summary: 'Jedna linija sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Detalji linije' })
  @ApiResponse({ status: 404, description: 'Linija nije pronađena' })
  @RequirePermissions('transport.administration.lines.main:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.linesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriranje linije (Glavni server)' })
  @ApiResponse({ status: 200, description: 'Linija uspešno ažurirana' })
  @ApiResponse({ status: 404, description: 'Linija nije pronađena' })
  @RequirePermissions('transport.administration.lines.main:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLineDto: UpdateLineDto,
  ) {
    return this.linesService.update(id, updateLineDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Brisanje linije (Glavni server)' })
  @ApiResponse({ status: 200, description: 'Linija uspešno obrisana' })
  @ApiResponse({ status: 404, description: 'Linija nije pronađena' })
  @RequirePermissions('transport.administration.lines.main:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.linesService.remove(id);
  }

  // ========== TIKETING SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('ticketing')
  @ApiOperation({ summary: 'Sve linije sa Tiketing servera (legacy)' })
  @ApiResponse({ status: 200, description: 'Lista linija' })
  @ApiQuery({ name: 'dateValidFrom', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.lines.ticketing:view')
  findAllTicketing(@Query() query: QueryLinesDto) {
    return this.linesService.findAllTicketing(
      query.dateValidFrom,
      query.page,
      query.limit,
    );
  }

  @Post('sync-ticketing')
  @ApiOperation({ summary: 'Sinhronizacija linija sa Tiketing servera' })
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
  @RequirePermissions('transport.administration.lines.ticketing:sync')
  async syncFromTicketing(@Req() req: Request) {
    const userId = (req.user as any)?.id || 1;
    return this.linesService.syncFromTicketing(userId);
  }

  @Post('sync-line-uids/:dateValidFrom')
  @ApiOperation({
    summary: 'Sinhronizacija stanica na linijama (price_lists_line_uids)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija stanica na linijama uspešno završena',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        tableName: { type: 'string' },
        tableCreated: { type: 'boolean' },
        totalRecords: { type: 'number' },
        inserted: { type: 'number' },
        duration: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Legacy baza nije pronađena' })
  @RequirePermissions('transport.administration.lines.ticketing:sync')
  async syncLineUids(@Param('dateValidFrom') dateValidFrom: string) {
    return this.linesService.syncLineUidsFromTicketing(dateValidFrom);
  }

  @Post('sync-line-uids-city/:dateValidFrom')
  @ApiOperation({
    summary: 'Sinhronizacija stanica na linijama sa City servera (price_lists_line_uids)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija stanica na linijama sa City servera uspešno završena',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        tableName: { type: 'string' },
        tableCreated: { type: 'boolean' },
        totalRecords: { type: 'number' },
        inserted: { type: 'number' },
        duration: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Legacy City baza nije pronađena' })
  @RequirePermissions('transport.administration.lines.city:sync')
  async syncLineUidsCity(@Param('dateValidFrom') dateValidFrom: string) {
    return this.linesService.syncLineUidsFromCity(dateValidFrom);
  }

  // ========== GRADSKI SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('city')
  @ApiOperation({ summary: 'Sve linije sa Gradskog servera (legacy)' })
  @ApiResponse({ status: 200, description: 'Lista linija' })
  @ApiQuery({ name: 'dateValidFrom', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.lines.city:view')
  findAllCity(@Query() query: QueryLinesDto) {
    return this.linesService.findAllCity(
      query.dateValidFrom,
      query.page,
      query.limit,
    );
  }

  @Post('sync-city')
  @ApiOperation({ summary: 'Sinhronizacija linija sa Gradskog servera' })
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
  @RequirePermissions('transport.administration.lines.city:sync')
  async syncFromCity(@Req() req: Request) {
    const userId = (req.user as any)?.id || 1;
    return this.linesService.syncFromCity(userId);
  }
}
