import { 
  Controller, 
  Post, 
  Body, 
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Ip,
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody } from '@nestjs/swagger';
import { GpsIngestService } from './gps-ingest.service';
import { GpsBatchDto } from './dto/gps-batch.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('GPS Ingest')
@Controller('gps-ingest')
export class GpsIngestController {
  private readonly logger = new Logger(GpsIngestController.name);

  constructor(private readonly gpsIngestService: GpsIngestService) {}

  @Post('batch')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Prima batch GPS podataka sa legacy servera' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API ključ za autentifikaciju',
    required: true,
  })
  @ApiBody({ type: GpsBatchDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Podaci uspešno primljeni i obrađeni',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        processed: { type: 'number' },
        failed: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Neispravni podaci' })
  @ApiResponse({ status: 401, description: 'Neautorizovan pristup' })
  async ingestBatch(
    @Headers('x-api-key') apiKey: string,
    @Body() gpsBatchDto: GpsBatchDto,
    @Ip() ipAddress: string,
    @Req() req: any,
  ) {
    // Proveri API ključ
    if (!apiKey) {
      throw new UnauthorizedException('API ključ je obavezan');
    }

    const userAgent = req.headers['user-agent'];
    const endpoint = req.originalUrl || req.url;
    const method = req.method;
    
    const isValidKey = await this.gpsIngestService.validateApiKey(
      apiKey, 
      ipAddress, 
      userAgent, 
      endpoint, 
      method
    );
    if (!isValidKey) {
      throw new UnauthorizedException('Neispravan API ključ');
    }

    // Validacija podataka
    if (!gpsBatchDto.data || !Array.isArray(gpsBatchDto.data)) {
      throw new BadRequestException('Podaci moraju biti niz GPS tačaka');
    }

    if (gpsBatchDto.data.length === 0) {
      throw new BadRequestException('Batch mora sadržati bar jednu GPS tačku');
    }

    if (gpsBatchDto.data.length > 10000) {
      throw new BadRequestException('Batch ne može sadržati više od 10000 tačaka');
    }

    // Obradi batch
    const startTime = Date.now();
    
    try {
      const result = await this.gpsIngestService.processBatch(
        gpsBatchDto.data,
        gpsBatchDto.source || 'legacy',
      );

      const processingTime = Date.now() - startTime;
      
      this.logger.log(
        `Batch obrađen: ${result.processed} uspešno, ${result.failed} neuspešno, vreme: ${processingTime}ms`,
      );

      return {
        success: true,
        processed: result.processed,
        failed: result.failed,
        processingTime,
        message: `Obrađeno ${result.processed} GPS tačaka`,
      };
    } catch (error) {
      this.logger.error('Greška pri obradi batch-a:', error);
      throw new BadRequestException('Greška pri obradi podataka');
    }
  }

  @Post('single')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Prima pojedinačnu GPS tačku' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API ključ za autentifikaciju',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Podatak uspešno primljen' })
  async ingestSingle(
    @Headers('x-api-key') apiKey: string,
    @Body() gpsData: any,
    @Ip() ipAddress: string,
    @Req() req: any,
  ) {
    // Proveri API ključ
    const userAgent = req.headers['user-agent'];
    const endpoint = req.originalUrl || req.url;
    const method = req.method;
    
    const isValidKey = await this.gpsIngestService.validateApiKey(
      apiKey, 
      ipAddress, 
      userAgent, 
      endpoint, 
      method
    );
    if (!isValidKey) {
      throw new UnauthorizedException('Neispravan API ključ');
    }

    // Obradi kao batch sa jednim elementom
    const result = await this.gpsIngestService.processBatch(
      [gpsData],
      'legacy',
    );

    return {
      success: result.processed === 1,
      message: result.processed === 1 ? 'GPS tačka uspešno primljena' : 'Greška pri obradi',
    };
  }

  @Post('test')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test endpoint za proveru konekcije' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API ključ za autentifikaciju',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Konekcija uspešna' })
  async testConnection(
    @Headers('x-api-key') apiKey: string,
    @Ip() ipAddress: string,
    @Req() req: any,
  ) {
    const userAgent = req.headers['user-agent'];
    const endpoint = req.originalUrl || req.url;
    const method = req.method;
    
    const isValidKey = await this.gpsIngestService.validateApiKey(
      apiKey, 
      ipAddress, 
      userAgent, 
      endpoint, 
      method
    );
    
    return {
      success: true,
      authenticated: isValidKey,
      timestamp: new Date(),
      message: isValidKey ? 'Konekcija i autentifikacija uspešna' : 'Konekcija uspešna, ali API ključ nije valjan',
    };
  }
}