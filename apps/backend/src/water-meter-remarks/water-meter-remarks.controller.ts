import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaterMeterRemarksService } from './water-meter-remarks.service';
import { CreateWaterMeterRemarkDto } from './dto/create-water-meter-remark.dto';
import { UpdateWaterMeterRemarkDto } from './dto/update-water-meter-remark.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Water Meter Remarks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('water-meter-remarks')
export class WaterMeterRemarksController {
  constructor(private readonly service: WaterMeterRemarksService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvati sva očitavanja vodomera' })
  @ApiResponse({ status: 200, description: 'Lista očitavanja vodomera' })
  @RequirePermissions('water_meter_remarks:view')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dohvati očitavanje po ID-u' })
  @ApiResponse({ status: 200, description: 'Očitavanje vodomera' })
  @ApiResponse({ status: 404, description: 'Očitavanje nije pronađeno' })
  @RequirePermissions('water_meter_remarks:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kreiraj novo očitavanje' })
  @ApiResponse({ status: 201, description: 'Očitavanje kreirano' })
  @RequirePermissions('water_meter_remarks:create')
  create(@Body() createDto: CreateWaterMeterRemarkDto) {
    return this.service.create(createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriraj očitavanje' })
  @ApiResponse({ status: 200, description: 'Očitavanje ažurirano' })
  @ApiResponse({ status: 404, description: 'Očitavanje nije pronađeno' })
  @RequirePermissions('water_meter_remarks:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateWaterMeterRemarkDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Obriši očitavanje' })
  @ApiResponse({ status: 200, description: 'Očitavanje obrisano' })
  @ApiResponse({ status: 404, description: 'Očitavanje nije pronađeno' })
  @RequirePermissions('water_meter_remarks:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
