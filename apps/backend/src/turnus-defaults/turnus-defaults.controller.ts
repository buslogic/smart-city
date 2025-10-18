import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TurnusDefaultsService, HistoryAnalysisResult } from './turnus-defaults.service';
import {
  CreateTurnusDefaultDto,
  UpdateTurnusDefaultDto,
  FindTurnusDefaultsDto,
  AnalyzeHistoryDto,
  DayOfWeek,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Turnus Defaults')
@ApiBearerAuth()
@Controller('turnus-defaults')
@UseGuards(JwtAuthGuard)
export class TurnusDefaultsController {
  constructor(private readonly turnusDefaultsService: TurnusDefaultsService) {}

  @Post()
  @RequirePermissions('transport.planning.turnus_defaults:create')
  @ApiOperation({
    summary: 'Kreira novi turnus default',
    description: 'Kreira default turnus za vozača sa opcionalnim parametrima (linija, smena, dan)',
  })
  @ApiResponse({
    status: 201,
    description: 'Turnus default je uspešno kreiran',
  })
  @ApiResponse({
    status: 400,
    description: 'Nevažeći podaci ili korisnik nije vozač',
  })
  @ApiResponse({
    status: 404,
    description: 'Vozač nije pronađen',
  })
  @ApiResponse({
    status: 409,
    description: 'Default sa istim parametrima već postoji',
  })
  create(@Body() createDto: CreateTurnusDefaultDto, @Request() req) {
    return this.turnusDefaultsService.create(createDto, req.user.userId);
  }

  @Get()
  @RequirePermissions('transport.planning.turnus_defaults:view')
  @ApiOperation({
    summary: 'Pronalazi sve turnus defaults',
    description: 'Vraća listu svih turnus defaults sa opcijama filtriranja',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista turnus defaults',
  })
  findAll(@Query() query: FindTurnusDefaultsDto) {
    return this.turnusDefaultsService.findAll(query);
  }

  @Get('lines')
  @RequirePermissions('transport.planning.turnus_defaults:view')
  @ApiOperation({
    summary: 'Vraća listu svih linija',
    description: 'Vraća listu svih jedinstvenih linija iz date_travel_order tabele',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista linija',
  })
  getLines() {
    return this.turnusDefaultsService.getLines();
  }

  @Get('driver/:driverId/best-match')
  @RequirePermissions('transport.planning.turnus_defaults:view')
  @ApiOperation({
    summary: 'Pronalazi najbolji matching default za vozača',
    description: 'Pronalazi najspecifičniji aktivan default koji odgovara datim parametrima',
  })
  @ApiParam({
    name: 'driverId',
    description: 'ID vozača',
    type: Number,
  })
  @ApiQuery({
    name: 'lineNumber',
    description: 'Broj linije',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'shiftNumber',
    description: 'Broj smene (1 ili 2)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'dayOfWeek',
    description: 'Dan u nedelji',
    required: false,
    enum: DayOfWeek,
  })
  @ApiResponse({
    status: 200,
    description: 'Najbolji matching default ili null',
  })
  findBestMatch(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Query('lineNumber') lineNumber?: string,
    @Query('shiftNumber', new ParseIntPipe({ optional: true })) shiftNumber?: number,
    @Query('dayOfWeek') dayOfWeek?: DayOfWeek,
  ) {
    return this.turnusDefaultsService.findBestMatch(
      driverId,
      lineNumber,
      shiftNumber,
      dayOfWeek,
    );
  }

  @Get(':id')
  @RequirePermissions('transport.planning.turnus_defaults:view')
  @ApiOperation({
    summary: 'Pronalazi turnus default po ID-u',
    description: 'Vraća detalje jednog turnus default-a',
  })
  @ApiParam({
    name: 'id',
    description: 'ID turnus default-a',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Turnus default',
  })
  @ApiResponse({
    status: 404,
    description: 'Turnus default nije pronađen',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.turnusDefaultsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('transport.planning.turnus_defaults:update')
  @ApiOperation({
    summary: 'Ažurira turnus default',
    description: 'Ažurira postojeći turnus default',
  })
  @ApiParam({
    name: 'id',
    description: 'ID turnus default-a',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Turnus default je uspešno ažuriran',
  })
  @ApiResponse({
    status: 404,
    description: 'Turnus default nije pronađen',
  })
  @ApiResponse({
    status: 409,
    description: 'Default sa istim parametrima već postoji',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTurnusDefaultDto,
    @Request() req,
  ) {
    return this.turnusDefaultsService.update(id, updateDto, req.user.userId);
  }

  @Delete(':id')
  @RequirePermissions('transport.planning.turnus_defaults:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Briše turnus default',
    description: 'Trajno briše turnus default',
  })
  @ApiParam({
    name: 'id',
    description: 'ID turnus default-a',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Turnus default je uspešno obrisan',
  })
  @ApiResponse({
    status: 404,
    description: 'Turnus default nije pronađen',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.turnusDefaultsService.remove(id);
  }

  @Post('analyze-history')
  @RequirePermissions('transport.planning.turnus_defaults:analyze')
  @ApiOperation({
    summary: 'Analizira istoriju vožnji',
    description: 'Analizira date_travel_order zapise i vraća preporuke za defaults',
  })
  @ApiResponse({
    status: 200,
    description: 'Rezultati analize',
  })
  @ApiResponse({
    status: 400,
    description: 'Nevažeći parametri',
  })
  analyzeHistory(@Body() dto: AnalyzeHistoryDto, @Request() req): Promise<HistoryAnalysisResult[]> {
    return this.turnusDefaultsService.analyzeHistory(dto, req.user.userId);
  }

  @Post('generate-defaults')
  @RequirePermissions('transport.planning.turnus_defaults:generate')
  @ApiOperation({
    summary: 'Generiše defaults na osnovu analize',
    description: 'Automatski kreira turnus defaults na osnovu analize istorije',
  })
  @ApiResponse({
    status: 200,
    description: 'Defaults su uspešno generisani',
  })
  @ApiResponse({
    status: 400,
    description: 'Nevažeći parametri',
  })
  generateDefaults(@Body() dto: AnalyzeHistoryDto, @Request() req) {
    return this.turnusDefaultsService.generateDefaults(dto, req.user.userId);
  }
}
