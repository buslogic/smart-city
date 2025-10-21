import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MeasuringPointsService } from './measuring-points.service';
import { CreateMeasuringPointDto } from './dto/create-measuring-point.dto';
import { UpdateMeasuringPointDto } from './dto/update-measuring-point.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Measuring Points')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('measuring-points')
export class MeasuringPointsController {
  constructor(private readonly service: MeasuringPointsService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvati sva merna mesta' })
  @ApiResponse({ status: 200, description: 'Lista mernih mesta' })
  @RequirePermissions('measuring_points:view')
  findAll() {
    return this.service.findAll();
  }

  @Get(':idmm')
  @ApiOperation({ summary: 'Dohvati merno mesto po IDMM' })
  @ApiResponse({ status: 200, description: 'Merno mesto' })
  @ApiResponse({ status: 404, description: 'Merno mesto nije pronađeno' })
  @RequirePermissions('measuring_points:view')
  findOne(@Param('idmm', ParseIntPipe) idmm: number) {
    return this.service.findOne(idmm);
  }

  @Post()
  @ApiOperation({ summary: 'Kreiraj novo merno mesto' })
  @ApiResponse({ status: 201, description: 'Merno mesto kreirano' })
  @RequirePermissions('measuring_points:create')
  create(@Body() createDto: CreateMeasuringPointDto) {
    return this.service.create(createDto);
  }

  @Patch(':idmm')
  @ApiOperation({ summary: 'Ažuriraj merno mesto' })
  @ApiResponse({ status: 200, description: 'Merno mesto ažurirano' })
  @ApiResponse({ status: 404, description: 'Merno mesto nije pronađeno' })
  @RequirePermissions('measuring_points:update')
  update(@Param('idmm', ParseIntPipe) idmm: number, @Body() updateDto: UpdateMeasuringPointDto) {
    return this.service.update(idmm, updateDto);
  }

  @Delete(':idmm')
  @ApiOperation({ summary: 'Obriši merno mesto' })
  @ApiResponse({ status: 200, description: 'Merno mesto obrisano' })
  @ApiResponse({ status: 404, description: 'Merno mesto nije pronađeno' })
  @RequirePermissions('measuring_points:delete')
  remove(@Param('idmm', ParseIntPipe) idmm: number) {
    return this.service.remove(idmm);
  }

  @Post('history')
  @ApiOperation({ summary: 'Dohvati istoriju promena za merno mesto' })
  @ApiResponse({ status: 200, description: 'Istorija promena' })
  @RequirePermissions('measuring_points:view')
  getHistory(@Body() body: { idmm: number }) {
    return this.service.getMeasuringPointsHistory(body.idmm);
  }

  @Post('cities')
  @ApiOperation({ summary: 'Dohvati gradove/naselja za SearchList' })
  @ApiResponse({ status: 200, description: 'Lista gradova/naselja' })
  @RequirePermissions('measuring_points:view')
  getCities(@Body() body: { query?: string; pageNumber?: number }) {
    return this.service.getCities(body);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Dohvati adrese za SearchList' })
  @ApiResponse({ status: 200, description: 'Lista adresa' })
  @RequirePermissions('measuring_points:view')
  getAddresses(@Body() body: { query?: string; pageNumber?: number }) {
    return this.service.getAddresses(body);
  }

  @Post('status-options')
  @ApiOperation({ summary: 'Dohvati opcije statusa za SearchList' })
  @ApiResponse({ status: 200, description: 'Lista statusa' })
  @RequirePermissions('measuring_points:view')
  getStatusOptions(@Body() body: { query?: string; pageNumber?: number }) {
    return this.service.getStatusOptions(body);
  }

  @Post('type-options')
  @ApiOperation({ summary: 'Dohvati opcije tipova za SearchList' })
  @ApiResponse({ status: 200, description: 'Lista tipova' })
  @RequirePermissions('measuring_points:view')
  getTypeOptions(@Body() body: { query?: string; pageNumber?: number }) {
    return this.service.getTypeOptions(body);
  }

  @Post('house-council-options')
  @ApiOperation({ summary: 'Dohvati opcije kućnih saveta za SearchList' })
  @ApiResponse({ status: 200, description: 'Lista kućnih saveta' })
  @RequirePermissions('measuring_points:view')
  getHouseCouncilOptions(@Body() body: { query?: string; pageNumber?: number }) {
    return this.service.getHouseCouncilOptions(body);
  }

  @Post('primary-measuring-points')
  @ApiOperation({ summary: 'Dohvati primarna merna mesta za SearchList' })
  @ApiResponse({ status: 200, description: 'Lista primarnih mernih mesta' })
  @RequirePermissions('measuring_points:view')
  getPrimaryMeasuringPoints(@Body() body: { query?: string; pageNumber?: number; excludeId?: string }) {
    return this.service.getPrimaryMeasuringPoints(body);
  }
}
