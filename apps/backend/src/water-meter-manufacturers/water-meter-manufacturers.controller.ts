import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaterMeterManufacturersService } from './water-meter-manufacturers.service';
import { CreateWaterMeterManufacturerDto } from './dto/create-water-meter-manufacturer.dto';
import { UpdateWaterMeterManufacturerDto } from './dto/update-water-meter-manufacturer.dto';
import { SearchManufacturerDto } from './dto/search-manufacturer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Water Meter Manufacturers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('water-meter-manufacturers')
export class WaterMeterManufacturersController {
  constructor(private readonly service: WaterMeterManufacturersService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvati sve proizvođače vodomera' })
  @ApiResponse({ status: 200, description: 'Lista proizvođača' })
  @RequirePermissions('water_meter_manufacturers:view')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dohvati proizvođača po ID-u' })
  @ApiResponse({ status: 200, description: 'Proizvođač vodomera' })
  @ApiResponse({ status: 404, description: 'Proizvođač nije pronađen' })
  @RequirePermissions('water_meter_manufacturers:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kreiraj novog proizvođača' })
  @ApiResponse({ status: 201, description: 'Proizvođač kreiran' })
  @RequirePermissions('water_meter_manufacturers:create')
  create(@Body() createDto: CreateWaterMeterManufacturerDto) {
    return this.service.create(createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriraj proizvođača' })
  @ApiResponse({ status: 200, description: 'Proizvođač ažuriran' })
  @ApiResponse({ status: 404, description: 'Proizvođač nije pronađen' })
  @RequirePermissions('water_meter_manufacturers:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateWaterMeterManufacturerDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Obriši proizvođača' })
  @ApiResponse({ status: 200, description: 'Proizvođač obrisan' })
  @ApiResponse({ status: 404, description: 'Proizvođač nije pronađen' })
  @RequirePermissions('water_meter_manufacturers:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post('search')
  @ApiOperation({ summary: 'Pretraži proizvođače za SearchList komponentu' })
  @ApiResponse({ status: 200, description: 'Lista proizvođača za dropdown' })
  @RequirePermissions('water_meter_manufacturers:view')
  searchForList(@Body() searchDto: SearchManufacturerDto) {
    return this.service.searchForList(searchDto);
  }
}
