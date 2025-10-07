import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReplacementWaterMetersService } from './replacement-water-meters.service';
import { CreateReplacementWaterMeterDto } from './dto/create-replacement-water-meter.dto';
import { UpdateReplacementWaterMeterDto } from './dto/update-replacement-water-meter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Replacement Water Meters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('replacement-water-meters')
export class ReplacementWaterMetersController {
  constructor(private readonly service: ReplacementWaterMetersService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvati sve zamenjene vodomere' })
  @ApiResponse({ status: 200, description: 'Lista zamenjenih vodomera' })
  @RequirePermissions('replacement_water_meters:view')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dohvati zamenjeni vodomer po ID-u' })
  @ApiResponse({ status: 200, description: 'Zamenjeni vodomer' })
  @ApiResponse({ status: 404, description: 'Zamenjeni vodomer nije pronađen' })
  @RequirePermissions('replacement_water_meters:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kreiraj novi zapis o zamenjenom vodomeru' })
  @ApiResponse({ status: 201, description: 'Zamenjeni vodomer kreiran' })
  @RequirePermissions('replacement_water_meters:create')
  create(@Body() createDto: CreateReplacementWaterMeterDto) {
    return this.service.create(createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriraj zamenjeni vodomer' })
  @ApiResponse({ status: 200, description: 'Zamenjeni vodomer ažuriran' })
  @ApiResponse({ status: 404, description: 'Zamenjeni vodomer nije pronađen' })
  @RequirePermissions('replacement_water_meters:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateReplacementWaterMeterDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Obriši zamenjeni vodomer' })
  @ApiResponse({ status: 200, description: 'Zamenjeni vodomer obrisan' })
  @ApiResponse({ status: 404, description: 'Zamenjeni vodomer nije pronađen' })
  @RequirePermissions('replacement_water_meters:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
