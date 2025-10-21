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
import { PriceVariationsService } from './price-variations.service';
import { CreatePriceVariationDto } from './dto/create-price-variation.dto';
import { UpdatePriceVariationDto } from './dto/update-price-variation.dto';
import { QueryPriceVariationsDto } from './dto/query-price-variations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Price Variations')
@Controller('price-variations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PriceVariationsController {
  constructor(private readonly priceVariationsService: PriceVariationsService) {}

  // ========== GLAVNI SERVER ENDPOINTS ==========

  @Post()
  @ApiOperation({ summary: 'Kreiranje nove varijacije (Glavni server)' })
  @ApiResponse({ status: 201, description: 'Varijacija uspešno kreirana' })
  @RequirePermissions('transport.administration.variations.main:create')
  create(@Body() createPriceVariationDto: CreatePriceVariationDto) {
    return this.priceVariationsService.create(createPriceVariationDto);
  }

  @Get('main')
  @ApiOperation({ summary: 'Sve varijacije sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Lista varijacija' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.variations.main:view')
  findAllMain(@Query() query: QueryPriceVariationsDto) {
    return this.priceVariationsService.findAllMain(query.page, query.limit);
  }

  @Get('main/:id')
  @ApiOperation({ summary: 'Jedna varijacija sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Detalji varijacije' })
  @ApiResponse({ status: 404, description: 'Varijacija nije pronađena' })
  @RequirePermissions('transport.administration.variations.main:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.priceVariationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriranje varijacije (Glavni server)' })
  @ApiResponse({ status: 200, description: 'Varijacija uspešno ažurirana' })
  @ApiResponse({ status: 404, description: 'Varijacija nije pronađena' })
  @RequirePermissions('transport.administration.variations.main:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePriceVariationDto: UpdatePriceVariationDto,
  ) {
    return this.priceVariationsService.update(id, updatePriceVariationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Brisanje varijacije (Glavni server)' })
  @ApiResponse({ status: 200, description: 'Varijacija uspešno obrisana' })
  @ApiResponse({ status: 404, description: 'Varijacija nije pronađena' })
  @RequirePermissions('transport.administration.variations.main:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.priceVariationsService.remove(id);
  }

  // ========== TIKETING SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('ticketing')
  @ApiOperation({ summary: 'Sve varijacije sa Tiketing servera (legacy)' })
  @ApiResponse({ status: 200, description: 'Lista varijacija' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.variations.ticketing:view')
  findAllTicketing(@Query() query: QueryPriceVariationsDto) {
    return this.priceVariationsService.findAllTicketing(query.page, query.limit);
  }

  @Post('sync-ticketing')
  @ApiOperation({ summary: 'Sinhronizacija varijacija sa Tiketing servera' })
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
  @RequirePermissions('transport.administration.variations.ticketing:sync')
  async syncFromTicketing(@Req() req: Request) {
    const userId = (req.user as any)?.id || 1;
    return this.priceVariationsService.syncFromTicketing(userId);
  }

  // ========== GRADSKI SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('city')
  @ApiOperation({ summary: 'Sve varijacije sa Gradskog servera (legacy)' })
  @ApiResponse({ status: 200, description: 'Lista varijacija' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.variations.city:view')
  findAllCity(@Query() query: QueryPriceVariationsDto) {
    return this.priceVariationsService.findAllCity(query.page, query.limit);
  }

  @Post('sync-city')
  @ApiOperation({ summary: 'Sinhronizacija varijacija sa Gradskog servera' })
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
  @RequirePermissions('transport.administration.variations.city:sync')
  async syncFromCity(@Req() req: Request) {
    const userId = (req.user as any)?.id || 1;
    return this.priceVariationsService.syncFromCity(userId);
  }
}
