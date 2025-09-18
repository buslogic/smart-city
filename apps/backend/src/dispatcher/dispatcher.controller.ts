import {
  Controller,
  Get,
  Post,
  Query,
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
}
