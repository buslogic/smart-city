import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { StopsSyncService } from './stops-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { StopDto, SyncResponseDto } from './dto';

@Controller('stops-sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StopsSyncController {
  constructor(private readonly stopsSyncService: StopsSyncService) {}

  // ========== GLAVNI SERVER ==========

  @Get('main')
  @RequirePermissions('transport.administration.stops_sync.main:view')
  async getAllMain(): Promise<StopDto[]> {
    return this.stopsSyncService.findAllMain();
  }

  // ========== TIKETING SERVER ==========

  @Get('ticketing')
  @RequirePermissions('transport.administration.stops_sync.ticketing:view')
  async getAllTicketing(): Promise<StopDto[]> {
    return this.stopsSyncService.findAllTicketing();
  }

  @Post('ticketing/sync')
  @RequirePermissions('transport.administration.stops_sync.ticketing:sync')
  async syncFromTicketing(): Promise<SyncResponseDto> {
    return this.stopsSyncService.syncFromTicketing();
  }

  // ========== GRADSKI SERVER ==========

  @Get('city')
  @RequirePermissions('transport.administration.stops_sync.city:view')
  async getAllCity(): Promise<StopDto[]> {
    return this.stopsSyncService.findAllCity();
  }

  @Post('city/sync')
  @RequirePermissions('transport.administration.stops_sync.city:sync')
  async syncFromCity(): Promise<SyncResponseDto> {
    return this.stopsSyncService.syncFromCity();
  }
}
