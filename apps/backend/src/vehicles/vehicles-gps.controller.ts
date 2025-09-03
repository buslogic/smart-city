import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Vehicles GPS Export')
@Controller('vehicles-gps')
export class VehiclesGpsController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get('export')
  @Public()
  @ApiOperation({ summary: 'Export vozila za GPS legacy sistem (samo aktivna vozila)' })
  @ApiResponse({ status: 200, description: 'Lista vozila sa id i garageNumber' })
  @ApiResponse({ status: 401, description: 'Neispravna API key' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key za pristup',
    required: true,
  })
  async exportForGps(@Headers('x-api-key') apiKey: string) {
    // Proveri API key
    if (apiKey !== 'gps-sync-key-2025') {
      throw new UnauthorizedException('Invalid API key');
    }

    return this.vehiclesService.exportForGps();
  }
}