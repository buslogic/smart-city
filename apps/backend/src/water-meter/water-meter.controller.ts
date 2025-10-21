import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaterMeterService } from './water-meter.service';
import { CreateWaterMeterDto } from './dto/create-water-meter.dto';
import { UpdateWaterMeterDto } from './dto/update-water-meter.dto';
import { SearchMeasuringPointDto } from './dto/search-measuring-point.dto';
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

  @Post('search/measuring-points')
  @ApiOperation({ summary: 'Pretraži merna mesta za SearchList komponentu' })
  @ApiResponse({ status: 200, description: 'Lista mernih mesta za dropdown' })
  @RequirePermissions('water_meters:view')
  searchMeasuringPoints(@Body() searchDto: SearchMeasuringPointDto) {
    return this.service.searchMeasuringPoints(
      searchDto.query,
      searchDto.pageNumber,
      searchDto.limit,
    );
  }

  @Post('measuring-points/search-list')
  @ApiOperation({ summary: 'Pretraži merna mesta za SearchList komponentu (alias)' })
  @ApiResponse({ status: 200, description: 'Lista mernih mesta za dropdown' })
  @RequirePermissions('water_meters:view')
  searchMeasuringPointsAlias(@Body() body: { search?: string; page?: number; limit?: number }) {
    return this.service.searchMeasuringPoints(
      body.search || '',
      body.page || 0,
      body.limit || 20,
    );
  }

  @Post('measuring-point')
  @ApiOperation({ summary: 'Dohvati merno mesto po IDMM' })
  @ApiResponse({ status: 200, description: 'Detalji mernog mesta' })
  @ApiResponse({ status: 404, description: 'Merno mesto nije pronađeno' })
  @RequirePermissions('water_meters:view')
  getMeasuringPointByIDMM(@Body() body: { idmm: number }) {
    return this.service.getMeasuringPointByIDMM(body.idmm);
  }

  @Post('unassigned-for-sl')
  @ApiOperation({ summary: 'Dohvati nedodeljene vodomere za SearchList' })
  @ApiResponse({ status: 200, description: 'Lista nedodeljenih vodomera' })
  @RequirePermissions('water_meters:view')
  getUnassignedWaterMetersForSL(@Body() body: { query?: string; pageNumber?: number }) {
    return this.service.getUnassignedWaterMetersForSL(body);
  }

  @Post('by-idmm')
  @ApiOperation({ summary: 'Dohvati vodomer po IDMM' })
  @ApiResponse({ status: 200, description: 'Detalji vodomera' })
  @ApiResponse({ status: 404, description: 'Vodomer nije pronađen' })
  @RequirePermissions('water_meters:view')
  getWaterMeterByIDMM(@Body() body: { idmm: number }) {
    return this.service.getWaterMeterByIDMM(body.idmm);
  }

  @Post('history')
  @ApiOperation({ summary: 'Dohvati istoriju promena vodomera po IDV' })
  @ApiResponse({ status: 200, description: 'Istorija promena vodomera' })
  @RequirePermissions('water_meters:view')
  getWaterMeterHistoryByIDV(@Body() body: { idv: number }) {
    return this.service.getWaterMeterHistoryByIDV(body.idv);
  }

  @Post('assigned-user')
  @ApiOperation({ summary: 'Dohvati dodeljenog korisnika za vodomer' })
  @ApiResponse({ status: 200, description: 'Dodeljen korisnik' })
  @RequirePermissions('water_meters:view')
  async getAssignedUser(@Body() body: { id: number }) {
    const data = await this.service.getAssignedUser(body.id);
    return { success: true, data };
  }

  @Post('assign-to-user')
  @ApiOperation({ summary: 'Dodeli vodomer korisniku' })
  @ApiResponse({ status: 200, description: 'Vodomer dodeljen' })
  @RequirePermissions('water_meters:update')
  async assignWaterMeterToUser(@Body() body: { id: number; sifra_potrosaca?: string; sifra_kupca?: string }) {
    const success = await this.service.assignWaterMeterToUser(body);
    return { success };
  }
}
