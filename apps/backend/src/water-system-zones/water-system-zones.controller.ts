import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { WaterSystemZonesService } from './water-system-zones.service';
import { CreateWaterSystemZoneDto } from './dto/create-water-system-zone.dto';
import { UpdateWaterSystemZoneDto } from './dto/update-water-system-zone.dto';
import { CreateZoneMeasuringPointDto } from './dto/create-zone-measuring-point.dto';

@Controller('water-system-zones')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterSystemZonesController {
  constructor(private readonly waterSystemZonesService: WaterSystemZonesService) {}

  @Get()
  @RequirePermissions('water_system_zones:read')
  async findAll() {
    return this.waterSystemZonesService.findAll();
  }

  @Get('zone-types/search-list')
  @RequirePermissions('water_system_zones:read')
  async getZoneTypesForSearchList(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.waterSystemZonesService.getZoneTypesForSearchList(
      search || '',
      parseInt(page || '0', 10),
      parseInt(limit || '20', 10),
    );
  }

  @Post('zone-types/search-list')
  @RequirePermissions('water_system_zones:read')
  async getZoneTypesForSearchListPost(
    @Body() body: { search?: string; page?: number; limit?: number },
  ) {
    return this.waterSystemZonesService.getZoneTypesForSearchList(
      body.search || '',
      body.page || 0,
      body.limit || 20,
    );
  }

  @Get(':id')
  @RequirePermissions('water_system_zones:read')
  async findOne(@Param('id') id: string) {
    return this.waterSystemZonesService.findOne(+id);
  }

  @Post()
  @RequirePermissions('water_system_zones:create')
  async create(@Body() createDto: CreateWaterSystemZoneDto) {
    const data = await this.waterSystemZonesService.create(createDto);
    return { success: !!data, data };
  }

  @Put(':id')
  @RequirePermissions('water_system_zones:update')
  async update(@Param('id') id: string, @Body() updateDto: UpdateWaterSystemZoneDto) {
    const data = await this.waterSystemZonesService.update(+id, updateDto);
    return { success: !!data, data };
  }

  @Delete(':id')
  @RequirePermissions('water_system_zones:delete')
  async remove(@Param('id') id: string) {
    return this.waterSystemZonesService.remove(+id);
  }

  // Zone Measuring Points endpoints
  @Get(':id/measuring-points')
  @RequirePermissions('water_system_zones:read')
  async getZoneMeasuringPoints(@Param('id') id: string) {
    return this.waterSystemZonesService.getZoneMeasuringPoints(+id);
  }

  @Post('measuring-points')
  @RequirePermissions('water_system_zones:create')
  async createZoneMeasuringPoint(@Body() createDto: CreateZoneMeasuringPointDto) {
    return this.waterSystemZonesService.createZoneMeasuringPoint(createDto);
  }

  @Delete(':zoneId/measuring-points/:idmm')
  @RequirePermissions('water_system_zones:delete')
  async deleteZoneMeasuringPoint(
    @Param('zoneId') zoneId: string,
    @Param('idmm') idmm: string,
  ) {
    const result = await this.waterSystemZonesService.deleteZoneMeasuringPoint(+zoneId, +idmm);
    return { success: result };
  }
}
