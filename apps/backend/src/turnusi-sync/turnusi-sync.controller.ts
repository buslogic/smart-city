import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TurnusiSyncService } from './turnusi-sync.service';
import { QueryTurnusiDto } from './dto/query-turnusi.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Turnusi Sync')
@Controller('turnusi-sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TurnusiSyncController {
  constructor(private readonly turnusiSyncService: TurnusiSyncService) {}

  // ========== TIKETING SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('ticketing/groups')
  @ApiOperation({
    summary: 'Grupe turnusa sa Tiketing servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista grupa turnusa' })
  @RequirePermissions('transport.administration.turnusi_sync.ticketing:view')
  getAllGroupsTicketing() {
    return this.turnusiSyncService.getAllGroupsTicketing();
  }

  @Get('ticketing/assign')
  @ApiOperation({
    summary: 'Dodele turnusa sa Tiketing servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista dodela turnusa' })
  @ApiQuery({ name: 'groupId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.turnusi_sync.ticketing:view')
  getAllAssignTicketing(@Query() query: QueryTurnusiDto) {
    return this.turnusiSyncService.getAllAssignTicketing(
      query.groupId,
      query.page,
      query.limit,
    );
  }

  @Get('ticketing/days')
  @ApiOperation({
    summary: 'Dani turnusa sa Tiketing servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista dana turnusa' })
  @ApiQuery({ name: 'groupId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.turnusi_sync.ticketing:view')
  getAllDaysTicketing(@Query() query: QueryTurnusiDto) {
    return this.turnusiSyncService.getAllDaysTicketing(
      query.groupId,
      query.page,
      query.limit,
    );
  }

  @Post('sync-ticketing')
  @ApiOperation({
    summary: 'Sinhronizacija Turnusa sa Tiketing servera',
  })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija uspešno završena',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        turnusGroupsNames: {
          type: 'object',
          properties: {
            created: { type: 'number' },
            updated: { type: 'number' },
            skipped: { type: 'number' },
            errors: { type: 'number' },
            totalProcessed: { type: 'number' },
          },
        },
        turnusGroupsAssign: {
          type: 'object',
          properties: {
            created: { type: 'number' },
            updated: { type: 'number' },
            skipped: { type: 'number' },
            errors: { type: 'number' },
            totalProcessed: { type: 'number' },
          },
        },
        turnusDays: {
          type: 'object',
          properties: {
            created: { type: 'number' },
            updated: { type: 'number' },
            skipped: { type: 'number' },
            errors: { type: 'number' },
            totalProcessed: { type: 'number' },
          },
        },
        totalProcessed: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Legacy baza nije pronađena' })
  @RequirePermissions('transport.administration.turnusi_sync.ticketing:sync')
  async syncFromTicketing(@Req() req: Request) {
    const userId = (req.user as any)?.id || 1;
    return this.turnusiSyncService.syncAllFromTicketing(userId);
  }
}
