import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LinesAdministrationService } from './lines-administration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  GetLinesQueryDto,
  PaginatedLinesResponseDto,
  PriceTableGroupDto,
} from './dto';

@Controller('lines-administration')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LinesAdministrationController {
  constructor(
    private readonly linesAdministrationService: LinesAdministrationService
  ) {}

  @Get('groups')
  @RequirePermissions('transport.administration.lines_admin:view')
  async getPriceTableGroups(): Promise<PriceTableGroupDto[]> {
    return this.linesAdministrationService.getPriceTableGroups();
  }

  @Get('lines')
  @RequirePermissions('transport.administration.lines_admin:view')
  async getLines(
    @Query() query: GetLinesQueryDto
  ): Promise<PaginatedLinesResponseDto> {
    return this.linesAdministrationService.getLines(query);
  }
}
