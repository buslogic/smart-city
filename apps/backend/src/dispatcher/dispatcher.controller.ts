import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { DispatcherService } from './dispatcher.service';

@ApiTags('Dispatcher')
@Controller('dispatcher')
@ApiBearerAuth()
export class DispatcherController {
  constructor(private readonly dispatcherService: DispatcherService) {}

  @Get('current-positions')
  @Public()
  @ApiOperation({ summary: 'Dohvati trenutne pozicije vozila' })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['local', 'legacy'],
    description:
      'Izvor podataka: local (lokalna baza) ili legacy (direktno sa GPS servera)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Broj rezultata (default: 100)',
  })
  @ApiResponse({ status: 200, description: 'Lista trenutnih pozicija vozila' })
  @ApiResponse({ status: 400, description: 'Neispravni parametri' })
  @ApiResponse({ status: 500, description: 'Greška pri dohvatanju podataka' })
  async getCurrentPositions(
    @Query('source') source?: string,
    @Query('limit') limit?: number,
  ) {
    // Validacija source parametra
    const validSources = ['local', 'legacy'];
    const dataSource = source || 'local';

    if (!validSources.includes(dataSource)) {
      throw new BadRequestException(
        `Neispravan source. Dozvoljene vrednosti: ${validSources.join(', ')}`,
      );
    }

    try {
      const positions = await this.dispatcherService.getCurrentVehiclePositions(
        dataSource as 'local' | 'legacy',
        limit || 100,
      );

      return {
        success: true,
        source: dataSource,
        count: positions.length,
        timestamp: new Date(),
        data: positions,
      };
    } catch (error: any) {
      // Prosledi specifičnu poruku greške klijentu
      throw new BadRequestException({
        message: error.message || 'Greška pri dohvatanju podataka',
        error: 'VehiclePositionError',
        statusCode: 400,
        source: dataSource,
        details:
          error.code === 'ETIMEDOUT' ? 'CONNECTION_TIMEOUT' : 'GENERAL_ERROR',
      });
    }
  }

  @Get('drivers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Dohvati listu vozača' })
  @ApiResponse({ status: 200, description: 'Lista vozača' })
  @ApiResponse({ status: 401, description: 'Neautorizovan pristup' })
  async getDrivers() {
    try {
      const drivers = await this.dispatcherService.getDrivers();
      return {
        success: true,
        count: drivers.length,
        data: drivers,
      };
    } catch (error: any) {
      throw new BadRequestException({
        message: error.message || 'Greška pri dohvatanju vozača',
        error: 'DriverListError',
        statusCode: 400,
      });
    }
  }

  @Get('driver-card/:driverId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Dohvati podatke za karton vozača' })
  @ApiResponse({ status: 200, description: 'Podaci za karton vozača' })
  @ApiResponse({ status: 404, description: 'Vozač nije pronađen' })
  async getDriverCard(@Param('driverId') driverId: string) {
    try {
      const driverCard = await this.dispatcherService.getDriverCard(parseInt(driverId));
      return {
        success: true,
        data: driverCard,
      };
    } catch (error: any) {
      throw new BadRequestException({
        message: error.message || 'Greška pri dohvatanju kartona vozača',
        error: 'DriverCardError',
        statusCode: 400,
      });
    }
  }

  @Post('sync-gps-data')
  @Public()
  @ApiOperation({
    summary: 'Sinhronizuje GPS podatke iz legacy baze u lokalnu',
  })
  @ApiResponse({ status: 200, description: 'Sinhronizacija uspešna' })
  @ApiResponse({ status: 500, description: 'Greška pri sinhronizaciji' })
  async syncGPSData() {
    try {
      const result = await this.dispatcherService.syncGPSData();
      return {
        success: true,
        message: 'Sinhronizacija završena',
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('vehicle-history/:vehicleId')
  @Public()
  @ApiOperation({ summary: 'Dohvati GPS istoriju vozila za zadati period' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    description: 'Početni datum (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: String,
    description: 'Krajnji datum (ISO format)',
  })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['gps_data', 'gps_data_lag_filtered'],
    description: 'Izvor GPS podataka (default: gps_data)',
  })
  @ApiResponse({ status: 200, description: 'GPS istorija vozila' })
  @ApiResponse({ status: 400, description: 'Neispravni parametri' })
  async getVehicleHistory(
    @Param('vehicleId') vehicleId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('source') source?: string,
  ) {
    try {
      const dataSource = source === 'gps_data_lag_filtered' ? 'gps_data_lag_filtered' : 'gps_data';

      // DEBUG: Loguj koji source parametar stiže
      console.log(`🔍 [Controller] Primljeni source parametar: "${source}"`);
      console.log(`📊 [Controller] Koristi se tabela: "${dataSource}"`);

      const result = await this.dispatcherService.getVehicleHistory(
        parseInt(vehicleId),
        new Date(startDate),
        new Date(endDate),
        dataSource,
      );

      return {
        success: true,
        vehicleId: parseInt(vehicleId),
        period: {
          start: startDate,
          end: endDate,
        },
        ...result,
      };
    } catch (error: any) {
      throw new BadRequestException({
        message: error.message || 'Greška pri dohvatanju istorije vozila',
        error: 'VehicleHistoryError',
        statusCode: 400,
      });
    }
  }
}
