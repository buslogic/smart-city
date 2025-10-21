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
import { PriceListGroupsService } from './price-list-groups.service';
import { CreatePriceListGroupDto } from './dto/create-price-list-group.dto';
import { UpdatePriceListGroupDto } from './dto/update-price-list-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Price List Groups')
@Controller('price-list-groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PriceListGroupsController {
  constructor(
    private readonly priceListGroupsService: PriceListGroupsService,
  ) {}

  // ========== GLAVNI SERVER ENDPOINTS ==========

  @Post()
  @ApiOperation({ summary: 'Kreiranje nove grupe cenovnika (Glavni server)' })
  @ApiResponse({ status: 201, description: 'Grupa cenovnika uspešno kreirana' })
  @RequirePermissions('transport.administration.price_list_groups.main:create')
  create(@Body() createPriceListGroupDto: CreatePriceListGroupDto) {
    return this.priceListGroupsService.create(createPriceListGroupDto);
  }

  @Get('main')
  @ApiOperation({ summary: 'Sve grupe cenovnika sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Lista grupa cenovnika' })
  @RequirePermissions('transport.administration.price_list_groups.main:view')
  findAllMain() {
    return this.priceListGroupsService.findAllMain();
  }

  @Get('main/:id')
  @ApiOperation({ summary: 'Jedna grupa cenovnika sa Glavnog servera' })
  @ApiResponse({ status: 200, description: 'Detalji grupe cenovnika' })
  @ApiResponse({ status: 404, description: 'Grupa cenovnika nije pronađena' })
  @RequirePermissions('transport.administration.price_list_groups.main:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.priceListGroupsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriranje grupe cenovnika (Glavni server)' })
  @ApiResponse({ status: 200, description: 'Grupa cenovnika uspešno ažurirana' })
  @ApiResponse({ status: 404, description: 'Grupa cenovnika nije pronađena' })
  @RequirePermissions('transport.administration.price_list_groups.main:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePriceListGroupDto: UpdatePriceListGroupDto,
  ) {
    return this.priceListGroupsService.update(id, updatePriceListGroupDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Brisanje grupe cenovnika (Glavni server)' })
  @ApiResponse({ status: 200, description: 'Grupa cenovnika uspešno obrisana' })
  @ApiResponse({ status: 404, description: 'Grupa cenovnika nije pronađena' })
  @RequirePermissions('transport.administration.price_list_groups.main:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.priceListGroupsService.remove(id);
  }

  // ========== TIKETING SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('ticketing')
  @ApiOperation({ summary: 'Sve grupe cenovnika sa Tiketing servera (legacy)' })
  @ApiResponse({ status: 200, description: 'Lista grupa cenovnika' })
  @RequirePermissions(
    'transport.administration.price_list_groups.ticketing:view',
  )
  findAllTicketing() {
    return this.priceListGroupsService.findAllTicketing();
  }

  @Post('sync-ticketing')
  @ApiOperation({
    summary: 'Sinhronizacija grupa cenovnika sa Tiketing servera',
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
  @RequirePermissions(
    'transport.administration.price_list_groups.ticketing:sync',
  )
  async syncFromTicketing(@Req() req: Request) {
    const userId = (req.user as any)?.id || 1;
    return this.priceListGroupsService.syncFromTicketing(userId);
  }

  // ========== GRADSKI SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('city')
  @ApiOperation({ summary: 'Sve grupe cenovnika sa Gradskog servera (legacy)' })
  @ApiResponse({ status: 200, description: 'Lista grupa cenovnika' })
  @RequirePermissions('transport.administration.price_list_groups.city:view')
  findAllCity() {
    return this.priceListGroupsService.findAllCity();
  }

  @Post('sync-city')
  @ApiOperation({
    summary: 'Sinhronizacija grupa cenovnika sa Gradskog servera',
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
  @RequirePermissions('transport.administration.price_list_groups.city:sync')
  async syncFromCity(@Req() req: Request) {
    const userId = (req.user as any)?.id || 1;
    return this.priceListGroupsService.syncFromCity(userId);
  }
}
