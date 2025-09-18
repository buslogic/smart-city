import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { GpsProcessorService } from './gps-processor.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('GPS Legacy Integration')
@Controller('gps-legacy')
export class GpsLegacyController {
  private readonly logger = new Logger(GpsLegacyController.name);
  private readonly apiKey: string;

  constructor(private readonly gpsProcessorService: GpsProcessorService) {
    this.apiKey =
      process.env.GPS_LEGACY_API_KEY || 'gps-legacy-key-2025-secure';
  }

  @Post('ingest')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // Max 10 requests per minute per IP
  @ApiOperation({
    summary: 'Prijem GPS podataka sa legacy sistema',
    description:
      'Endpoint za prijem batch GPS podataka sa legacy PHP sistema. Zahteva API key autentifikaciju.',
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'API key za autentifikaciju legacy sistema',
    required: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        points: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              vehicleId: { type: 'number' },
              garageNo: { type: 'string' },
              timestamp: { type: 'number' },
              gpsTime: { type: 'string' },
              lat: { type: 'number' },
              lng: { type: 'number' },
              speed: { type: 'number' },
              angle: { type: 'number' },
              altitude: { type: 'number' },
              inRoute: { type: 'number' },
              inRouteUid: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Podaci uspešno primljeni',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        processed: { type: 'number' },
        failed: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Neispravna API key' })
  @ApiResponse({ status: 400, description: 'Neispravni podaci' })
  @ApiResponse({ status: 429, description: 'Previše zahteva - rate limit' })
  async ingestGpsData(@Headers('x-api-key') apiKey: string, @Body() data: any) {
    // Provera API key
    if (!apiKey || apiKey !== this.apiKey) {
      this.logger.warn(
        `Unauthorized access attempt with key: ${apiKey?.substring(0, 10)}...`,
      );
      throw new UnauthorizedException('Invalid API key');
    }

    // Validacija podataka
    if (!data || !data.points || !Array.isArray(data.points)) {
      throw new BadRequestException(
        'Invalid data format - points array required',
      );
    }

    if (data.points.length === 0) {
      throw new BadRequestException('Empty points array');
    }

    if (data.points.length > 500) {
      throw new BadRequestException(
        'Too many points in single batch (max 500)',
      );
    }

    // Log prijem podataka
    this.logger.log(
      `Received ${data.points.length} GPS points from legacy system`,
    );

    try {
      // Procesiranje podataka kroz postojeći servis
      const result = await this.gpsProcessorService.processLegacyBatch(
        data.points,
      );

      this.logger.log(
        `Successfully processed ${result.processed} points, failed: ${result.failed}`,
      );

      return {
        success: true,
        message: `Processed ${result.processed} GPS points`,
        processed: result.processed,
        failed: result.failed,
      };
    } catch (error) {
      this.logger.error('Error processing legacy GPS data', error);
      throw new BadRequestException(`Processing error: ${error.message}`);
    }
  }

  @Post('test')
  @Public()
  @ApiOperation({
    summary: 'Test endpoint za proveru konekcije',
    description: 'Vraća status bez procesiranja podataka',
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'API key za autentifikaciju',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Test uspešan',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  async testConnection(@Headers('x-api-key') apiKey: string) {
    if (!apiKey || apiKey !== this.apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return {
      success: true,
      message: 'GPS Legacy API is working',
      timestamp: new Date().toISOString(),
    };
  }
}
