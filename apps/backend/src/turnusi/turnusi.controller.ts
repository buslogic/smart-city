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
    summary: 'Sinhronizacija Changes Codes Tours sa Tiketing servera',
  })
  @ApiResponse({
    status: 200,
    description: 'Sinhronizacija uspešno završena',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'number' },
        created: { type: 'number' },
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
    return this.turnusiService.syncChangesCodesFromTicketing(dto.groupId, userId);
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
