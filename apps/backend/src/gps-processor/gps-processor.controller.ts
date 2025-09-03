import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GpsProcessorService } from './gps-processor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('GPS Processor')
@Controller('gps-processor')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GpsProcessorController {
  constructor(private readonly gpsProcessorService: GpsProcessorService) {}

  @Get('status')
  @RequirePermissions('gps.monitor')
  @ApiOperation({ summary: 'Dohvati status GPS buffer-a' })
  @ApiResponse({ 
    status: 200, 
    description: 'Status buffer-a',
    schema: {
      type: 'object',
      properties: {
        stats: { type: 'array' },
        total: { type: 'number' },
        processedTotal: { type: 'number' },
        lastProcessTime: { type: 'string' },
        isProcessing: { type: 'boolean' },
      },
    },
  })
  async getStatus() {
    return this.gpsProcessorService.getBufferStatus();
  }

  @Post('process')
  @RequirePermissions('gps.manage')
  @ApiOperation({ summary: 'Ručno pokreni procesiranje buffer-a' })
  @ApiResponse({ 
    status: 200, 
    description: 'Procesiranje pokrenuto',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async processManually() {
    return this.gpsProcessorService.processManually();
  }

  @Post('cleanup')
  @RequirePermissions('gps.manage')
  @ApiOperation({ summary: 'Počisti stare failed zapise' })
  @ApiResponse({ 
    status: 200, 
    description: 'Broj obrisanih zapisa',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'number' },
      },
    },
  })
  async cleanup() {
    const deleted = await this.gpsProcessorService.cleanupFailedRecords();
    return { deleted };
  }
}