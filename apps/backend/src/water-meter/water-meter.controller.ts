import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaterMeterService } from './water-meter.service';
import { CreateWaterMeterDto } from './dto/create-water-meter.dto';
import { UpdateWaterMeterDto } from './dto/update-water-meter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Water Meters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('water-meters')
export class WaterMeterController {
  constructor(private readonly service: WaterMeterService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvati sve vodomere' })
  @ApiResponse({ status: 200, description: 'Lista vodomera' })
  @RequirePermissions('water_meters:view')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dohvati vodomer po ID-u' })
  @ApiResponse({ status: 200, description: 'Vodomer' })
  @ApiResponse({ status: 404, description: 'Vodomer nije pronađen' })
  @RequirePermissions('water_meters:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kreiraj novi vodomer' })
  @ApiResponse({ status: 201, description: 'Vodomer kreiran' })
  @RequirePermissions('water_meters:create')
  create(@Body() createDto: CreateWaterMeterDto) {
    return this.service.create(createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriraj vodomer' })
  @ApiResponse({ status: 200, description: 'Vodomer ažuriran' })
  @ApiResponse({ status: 404, description: 'Vodomer nije pronađen' })
  @RequirePermissions('water_meters:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateWaterMeterDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Obriši vodomer' })
  @ApiResponse({ status: 200, description: 'Vodomer obrisan' })
  @ApiResponse({ status: 404, description: 'Vodomer nije pronađen' })
  @RequirePermissions('water_meters:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
