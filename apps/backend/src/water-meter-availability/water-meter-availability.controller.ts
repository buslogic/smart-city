import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaterMeterAvailabilityService } from './water-meter-availability.service';
import { CreateWaterMeterAvailabilityDto } from './dto/create-water-meter-availability.dto';
import { UpdateWaterMeterAvailabilityDto } from './dto/update-water-meter-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Water Meter Availability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('water-meter-availability')
export class WaterMeterAvailabilityController {
  constructor(private readonly service: WaterMeterAvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvati sve dostupnosti vodomera' })
  @ApiResponse({ status: 200, description: 'Lista dostupnosti vodomera' })
  @RequirePermissions('water_meter_availability:view')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dohvati dostupnost po ID-u' })
  @ApiResponse({ status: 200, description: 'Dostupnost vodomera' })
  @ApiResponse({ status: 404, description: 'Dostupnost nije pronađena' })
  @RequirePermissions('water_meter_availability:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kreiraj novu dostupnost' })
  @ApiResponse({ status: 201, description: 'Dostupnost kreirana' })
  @RequirePermissions('water_meter_availability:create')
  create(@Body() createDto: CreateWaterMeterAvailabilityDto) {
    return this.service.create(createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriraj dostupnost' })
  @ApiResponse({ status: 200, description: 'Dostupnost ažurirana' })
  @ApiResponse({ status: 404, description: 'Dostupnost nije pronađena' })
  @RequirePermissions('water_meter_availability:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateWaterMeterAvailabilityDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Obriši dostupnost' })
  @ApiResponse({ status: 200, description: 'Dostupnost obrisana' })
  @ApiResponse({ status: 404, description: 'Dostupnost nije pronađena' })
  @RequirePermissions('water_meter_availability:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
