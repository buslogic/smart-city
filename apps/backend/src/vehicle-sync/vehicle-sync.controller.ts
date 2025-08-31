import { 
  Controller, 
  Post, 
  Get, 
  Delete,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VehicleSyncService } from './vehicle-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Vehicle Sync')
@ApiBearerAuth()
@Controller('vehicle-sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehicleSyncController {
  constructor(private readonly vehicleSyncService: VehicleSyncService) {}

  @Post('start')
  @RequirePermissions('vehicles:sync')
  @ApiOperation({ summary: 'Pokreni sinhronizaciju vozila' })
  @ApiQuery({ name: 'type', required: false, enum: ['full', 'incremental'], description: 'Tip sinhronizacije' })
  @ApiQuery({ name: 'batchSize', required: false, type: Number, description: 'Veličina batch-a (default: 50)' })
  @ApiQuery({ name: 'delay', required: false, type: Number, description: 'Pauza između batch-ova u ms (default: 2000)' })
  @ApiResponse({ status: 200, description: 'Sinhronizacija pokrenuta' })
  @ApiResponse({ status: 400, description: 'Sinhronizacija već u toku' })
  async startSync(
    @Request() req,
    @Query('type', new DefaultValuePipe('full')) syncType: 'full' | 'incremental',
    @Query('batchSize', new DefaultValuePipe(50), ParseIntPipe) batchSize: number,
    @Query('delay', new DefaultValuePipe(2000), ParseIntPipe) delay: number,
  ) {
    try {
      const result = await this.vehicleSyncService.startSync(req.user.id, syncType, {
        batchSize,
        delay
      });
      return result;
    } catch (error) {
      throw error;
    }
  }

  @Delete('stop')
  @RequirePermissions('vehicles:sync')
  @ApiOperation({ summary: 'Zaustavi sinhronizaciju vozila' })
  @ApiResponse({ status: 200, description: 'Sinhronizacija zaustavljena' })
  @ApiResponse({ status: 400, description: 'Nema aktivne sinhronizacije' })
  async stopSync() {
    return this.vehicleSyncService.stopSync();
  }

  @Get('status')
  @RequirePermissions('vehicles:read')
  @ApiOperation({ summary: 'Trenutni status sinhronizacije' })
  @ApiResponse({ status: 200, description: 'Status sinhronizacije' })
  async getStatus() {
    return this.vehicleSyncService.getCurrentStatus();
  }

  @Get('history')
  @RequirePermissions('vehicles:read')
  @ApiOperation({ summary: 'Istorija sinhronizacija' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Broj rezultata' })
  @ApiResponse({ status: 200, description: 'Lista sinhronizacija' })
  async getHistory(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.vehicleSyncService.getSyncHistory(limit);
  }

  @Get(':id/details')
  @RequirePermissions('vehicles:read')
  @ApiOperation({ summary: 'Detalji sinhronizacije' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Broj stranice' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Broj rezultata po stranici' })
  @ApiResponse({ status: 200, description: 'Detalji sinhronizacije' })
  async getSyncDetails(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.vehicleSyncService.getSyncDetails(id, page, limit);
  }
}
