import { Controller, Get, Query, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { LinesAdministrationService } from './lines-administration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  GetLinesQueryDto,
  PaginatedLinesResponseDto,
  PriceTableGroupDto,
  TimetableResponseDto,
  StationTimesDto,
  StationsOnLineResponseDto,
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

  @Get('lines/:priceTableIdent/timetables')
  @RequirePermissions('transport.administration.lines_admin:view')
  async getTimetables(
    @Param('priceTableIdent') priceTableIdent: string
  ): Promise<TimetableResponseDto> {
    return this.linesAdministrationService.getTimetablesByPriceTableIdent(priceTableIdent);
  }

  @Get('station-times')
  @RequirePermissions('transport.administration.lines_admin:view')
  async getStationTimes(
    @Query('idlinije') idlinije: string,
    @Query('smer') smer: string,
    @Query('dan') dan: string,
    @Query('vreme') vreme: string
  ): Promise<StationTimesDto> {
    const result = await this.linesAdministrationService.getStationTimes(
      idlinije,
      parseInt(smer),
      dan,
      vreme
    );

    if (!result) {
      throw new NotFoundException('Station times not found for this departure');
    }

    return result;
  }

  @Get('lines/:priceTableIdent/stations')
  @RequirePermissions('transport.administration.lines_admin:view')
  async getStationsOnLine(
    @Param('priceTableIdent') priceTableIdent: string
  ): Promise<StationsOnLineResponseDto> {
    return this.linesAdministrationService.getStationsOnLine(priceTableIdent);
  }
}
