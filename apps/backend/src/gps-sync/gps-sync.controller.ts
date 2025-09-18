import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { GpsSyncService } from './gps-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

export class StartGpsSyncDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  vehicleId?: number | null;

  @ApiProperty({ required: false, type: [Number] })
  @IsOptional()
  vehicleIds?: number[] | null;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(100)
  @Max(5000)
  batchSize: number;

  @ApiProperty()
  @IsNumber()
  @Min(1000)
  @Max(10000)
  delay: number;
}

@ApiTags('GPS Sync')
@ApiBearerAuth()
@Controller('gps-sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GpsSyncController {
  constructor(private readonly gpsSyncService: GpsSyncService) {}

  @Post('start')
  @RequirePermissions('dispatcher.sync:start')
  @ApiOperation({ summary: 'Pokreni GPS sinhronizaciju' })
  @ApiBody({ type: StartGpsSyncDto })
  @ApiResponse({ status: 201, description: 'GPS sinhronizacija pokrenuta' })
  @ApiResponse({ status: 400, description: 'Sinhronizacija već u toku' })
  async startSync(@Request() req, @Body() dto: StartGpsSyncDto) {
    try {
      const result = await this.gpsSyncService.startSync(req.user.id, dto);
      return result;
    } catch (error) {
      if (error.message.includes('već u toku')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }
  }

  @Delete('stop')
  @RequirePermissions('dispatcher.sync:stop')
  @ApiOperation({ summary: 'Zaustavi GPS sinhronizaciju' })
  @ApiResponse({ status: 200, description: 'GPS sinhronizacija zaustavljena' })
  @ApiResponse({ status: 400, description: 'Nema aktivne sinhronizacije' })
  async stopSync() {
    try {
      return await this.gpsSyncService.stopSync();
    } catch (error) {
      if (error.message.includes('Nema aktivne')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }
  }

  @Delete('stop/:id')
  @RequirePermissions('dispatcher.sync:stop')
  @ApiOperation({ summary: 'Zaustavi specifičnu GPS sinhronizaciju' })
  @ApiResponse({ status: 200, description: 'GPS sinhronizacija zaustavljena' })
  @ApiResponse({ status: 404, description: 'Sinhronizacija nije pronađena' })
  async stopSyncById(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.gpsSyncService.stopSyncById(id);
    } catch (error) {
      if (error.message.includes('nije pronađena')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw error;
    }
  }

  @Get('status')
  @RequirePermissions('dispatcher.sync:view')
  @ApiOperation({ summary: 'Trenutni status GPS sinhronizacije' })
  @ApiResponse({ status: 200, description: 'Status GPS sinhronizacije' })
  async getStatus() {
    return this.gpsSyncService.getCurrentStatus();
  }

  @Post('cleanup')
  @RequirePermissions('dispatcher.sync:cleanup')
  @ApiOperation({ summary: 'Očisti stare nezavršene sinhronizacije' })
  @ApiResponse({ status: 200, description: 'Stare sinhronizacije očišćene' })
  async cleanupStale() {
    return this.gpsSyncService.cleanupAllStale();
  }

  @Get('history')
  @RequirePermissions('dispatcher.sync:view')
  @ApiOperation({ summary: 'Istorija GPS sinhronizacija' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Broj rezultata',
  })
  @ApiResponse({ status: 200, description: 'Lista GPS sinhronizacija' })
  async getHistory(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.gpsSyncService.getSyncHistory(limit);
  }

  @Get(':id/details')
  @RequirePermissions('dispatcher.sync:view')
  @ApiOperation({ summary: 'Detalji GPS sinhronizacije' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Broj stranice',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Broj rezultata po stranici',
  })
  @ApiResponse({ status: 200, description: 'Detalji GPS sinhronizacije' })
  async getSyncDetails(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.gpsSyncService.getSyncDetails(id, page, limit);
  }
}
