import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Controller('vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @RequirePermissions('vehicles:create')
  @ApiOperation({ summary: 'Kreiranje novog vozila' })
  @ApiResponse({ status: 201, description: 'Vozilo uspešno kreirano' })
  @ApiResponse({ status: 409, description: 'Vozilo sa tim garažnim brojem već postoji' })
  create(@Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.create(createVehicleDto);
  }

  @Get()
  @RequirePermissions('vehicles:read')
  @ApiOperation({ summary: 'Lista svih vozila sa paginacijom i filterima' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Broj stranice' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Broj rezultata po stranici' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Pretraga po garažnom broju, registraciji, itd.' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filter po statusu (aktivan/neaktivan)' })
  @ApiQuery({ name: 'vehicleType', required: false, type: Number, description: 'Filter po tipu vozila' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('vehicleType') vehicleType?: string,
  ) {
    const activeBoolean = active === 'true' ? true : active === 'false' ? false : undefined;
    const vehicleTypeNumber = vehicleType ? parseInt(vehicleType) : undefined;
    
    return this.vehiclesService.findAll(page, limit, search, activeBoolean, vehicleTypeNumber);
  }

  @Get('statistics')
  @RequirePermissions('vehicles:read')
  @ApiOperation({ summary: 'Statistika vozila' })
  @ApiResponse({ status: 200, description: 'Statistika vozila' })
  getStatistics() {
    return this.vehiclesService.getStatistics();
  }

  @Get('expiring-documents')
  @RequirePermissions('vehicles:read')
  @ApiOperation({ summary: 'Vozila sa dokumentima koji ističu' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Broj dana unapred (default: 30)' })
  getExpiringDocuments(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.vehiclesService.getExpiringDocuments(days);
  }

  @Get(':id')
  @RequirePermissions('vehicles:read')
  @ApiOperation({ summary: 'Detalji jednog vozila' })
  @ApiResponse({ status: 200, description: 'Vozilo pronađeno' })
  @ApiResponse({ status: 404, description: 'Vozilo nije pronađeno' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.findOne(id);
  }

  @Get('garage-number/:garageNumber')
  @RequirePermissions('vehicles:read')
  @ApiOperation({ summary: 'Pronađi vozilo po garažnom broju' })
  @ApiResponse({ status: 200, description: 'Vozilo pronađeno' })
  @ApiResponse({ status: 404, description: 'Vozilo nije pronađeno' })
  findByGarageNumber(@Param('garageNumber') garageNumber: string) {
    return this.vehiclesService.findByGarageNumber(garageNumber);
  }

  @Get('legacy/:legacyId')
  @RequirePermissions('vehicles:read')
  @ApiOperation({ summary: 'Pronađi vozilo po legacy ID' })
  @ApiResponse({ status: 200, description: 'Vozilo pronađeno' })
  @ApiResponse({ status: 404, description: 'Vozilo nije pronađeno' })
  findByLegacyId(@Param('legacyId', ParseIntPipe) legacyId: number) {
    return this.vehiclesService.findByLegacyId(legacyId);
  }


  @Patch(':id')
  @RequirePermissions('vehicles:update')
  @ApiOperation({ summary: 'Ažuriranje vozila' })
  @ApiResponse({ status: 200, description: 'Vozilo uspešno ažurirano' })
  @ApiResponse({ status: 404, description: 'Vozilo nije pronađeno' })
  @ApiResponse({ status: 409, description: 'Konflikt sa postojećim podacima' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVehicleDto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(id, updateVehicleDto);
  }

  @Delete(':id')
  @RequirePermissions('vehicles:delete')
  @ApiOperation({ summary: 'Brisanje vozila' })
  @ApiResponse({ status: 200, description: 'Vozilo uspešno obrisano' })
  @ApiResponse({ status: 404, description: 'Vozilo nije pronađeno' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.remove(id);
  }
}