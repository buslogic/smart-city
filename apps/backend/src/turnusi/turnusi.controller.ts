import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TurnusiService } from './turnusi.service';
import { QueryChangesCodeToursDto } from './dto/query-changes-codes-tours.dto';
import { QueryMainChangesCodesDto } from './dto/query-main-changes-codes.dto';
import { SyncChangesCodesToursDto } from './dto/sync-changes-codes-tours.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Turnusi')
@Controller('turnusi')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TurnusiController {
  constructor(private readonly turnusiService: TurnusiService) {}

  // ========== TIKETING SERVER ENDPOINTS (READ-ONLY) ==========

  @Get('ticketing/groups')
  @ApiOperation({
    summary: 'Grupe turnusa sa Tiketing servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista grupa turnusa' })
  @RequirePermissions('transport.administration.turnusi.ticketing:view')
  getAllGroupsTicketing() {
    return this.turnusiService.getAllGroupsTicketing();
  }

  @Get('ticketing/changes-codes')
  @ApiOperation({
    summary: 'Changes codes tours sa Tiketing servera (legacy)',
  })
  @ApiResponse({ status: 200, description: 'Lista changes codes tours' })
  @ApiQuery({ name: 'groupId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.turnusi.ticketing:view')
  getAllChangesCodesTicketing(@Query() query: QueryChangesCodeToursDto) {
    return this.turnusiService.getAllChangesCodesTicketing(
      query.groupName ? parseInt(query.groupName) : undefined,
      query.page,
      query.limit,
    );
  }

  @Post('sync-ticketing')
  @ApiOperation({
    summary:
      'Sinhronizacija Changes Codes Tours sa Tiketing servera (sa resume capability)',
    description:
      'Automatski detektuje nedovršene sync-ove i pokreće novi. UPSERT pristup osigurava konzistentnost podataka.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija uspešno završena',
    schema: {
      type: 'object',
      properties: {
        upserted: { type: 'number' },
        skipped: { type: 'number' },
        errors: { type: 'number' },
        totalProcessed: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Legacy baza nije pronađena' })
  @RequirePermissions('transport.administration.turnusi.ticketing:sync')
  async syncFromTicketing(
    @Body() dto: SyncChangesCodesToursDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.id || 1;
    return this.turnusiService.resumeOrStartSync(dto.groupId, userId);
  }

  @Post('sync-ticketing-async')
  @ApiOperation({
    summary:
      'Pokreće sinhronizaciju asinhrono i vraća syncId odmah za real-time praćenje',
    description:
      'Sync se izvršava u pozadini. Koristi vraćeni syncId za praćenje progresa preko /sync-status/:syncId endpoint-a.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync pokrenut, vraćen syncId',
    schema: {
      type: 'object',
      properties: {
        syncId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Legacy baza nije pronađena' })
  @RequirePermissions('transport.administration.turnusi.ticketing:sync')
  async syncFromTicketingAsync(
    @Body() dto: SyncChangesCodesToursDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.id || 1;
    return this.turnusiService.startSyncAsync(dto.groupId, userId);
  }

  @Get('sync-status/:syncId')
  @ApiOperation({
    summary: 'Provera statusa sinhronizacije',
    description:
      'Dohvata detalje o specifičnom sync-u po syncId. Koristi se za real-time praćenje progresa.',
  })
  @ApiResponse({
    status: 200,
    description: 'Status sinhronizacije',
  })
  @ApiResponse({ status: 404, description: 'Sync log nije pronađen' })
  @RequirePermissions('transport.administration.turnusi.ticketing:view')
  getSyncStatus(@Param('syncId') syncId: string) {
    return this.turnusiService.getSyncStatus(syncId);
  }

  @Get('sync-status/group/:groupId/incomplete')
  @ApiOperation({
    summary: 'Provera nedovršenih sync-ova za grupu',
    description:
      'Dohvata poslednji nedovršeni sync za grupu (ako postoji). Koristi se za detekciju prekinutih sync-ova.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nedovršeni sync ili null',
  })
  @RequirePermissions('transport.administration.turnusi.ticketing:view')
  getIncompleteSyncForGroup(@Param('groupId') groupId: string) {
    return this.turnusiService.getLastIncompleteSyncForGroup(parseInt(groupId));
  }

  // ========== GLAVNI SERVER ENDPOINTS (NAŠA BAZA) ==========

  @Get('main/changes-codes')
  @ApiOperation({
    summary: 'Changes codes tours iz naše smartcity_dev baze',
  })
  @ApiResponse({ status: 200, description: 'Lista changes codes tours' })
  @ApiQuery({ name: 'groupId', required: false, type: Number })
  @ApiQuery({ name: 'lineNumber', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @RequirePermissions('transport.administration.turnusi.main:view')
  getAllChangesCodesMain(@Query() query: QueryMainChangesCodesDto) {
    return this.turnusiService.getAllChangesCodesMain(
      query.groupId,
      query.lineNumber,
      query.page,
      query.limit,
    );
  }

  // ========== LOCAL DATABASE ENDPOINTS ==========

  @Get('local/by-line/:lineNumber')
  @ApiOperation({
    summary: 'Turnusi po broju linije iz lokalne baze',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista turnusa za odabranu liniju',
  })
  @RequirePermissions('transport.administration.lines_admin:view')
  getTurnusiByLineNumber(@Param('lineNumber') lineNumber: string) {
    return this.turnusiService.getTurnusiByLineNumber(lineNumber);
  }

  @Get('local/by-line/:lineNumber/grouped')
  @ApiOperation({
    summary: 'Turnusi grupisani po turnus_id za odabranu liniju',
  })
  @ApiResponse({
    status: 200,
    description: 'Grupisana lista turnusa sa agregatnim podacima',
  })
  @RequirePermissions('transport.administration.lines_admin:view')
  getTurnusiGroupedByLineNumber(@Param('lineNumber') lineNumber: string) {
    return this.turnusiService.getTurnusiGroupedByLineNumber(lineNumber);
  }
}
