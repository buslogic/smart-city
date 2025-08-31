import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { LegacyDatabasesService } from './legacy-databases.service';
import { CreateLegacyDatabaseDto } from './dto/create-legacy-database.dto';
import { UpdateLegacyDatabaseDto, TestConnectionDto } from './dto/update-legacy-database.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Legacy Databases')
@ApiBearerAuth()
@Controller('legacy-databases')
export class LegacyDatabasesController {
  constructor(private readonly legacyDatabasesService: LegacyDatabasesService) {}

  @Post()
  @RequirePermissions('settings.legacy_databases.create')
  @ApiOperation({ summary: 'Kreiranje nove legacy database konfiguracije' })
  @ApiResponse({ status: 201, description: 'Legacy database je uspešno kreirana' })
  @ApiResponse({ status: 403, description: 'Nemate dozvolu za kreiranje' })
  create(@Body() createLegacyDatabaseDto: CreateLegacyDatabaseDto) {
    return this.legacyDatabasesService.create(createLegacyDatabaseDto);
  }

  @Get()
  @RequirePermissions('settings.legacy_databases.read')
  @ApiOperation({ summary: 'Dohvatanje svih legacy database konfiguracija' })
  @ApiResponse({ status: 200, description: 'Lista legacy databases' })
  findAll() {
    return this.legacyDatabasesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('settings.legacy_databases.read')
  @ApiOperation({ summary: 'Dohvatanje legacy database po ID-u' })
  @ApiParam({ name: 'id', description: 'ID legacy database' })
  @ApiResponse({ status: 200, description: 'Legacy database podaci' })
  @ApiResponse({ status: 404, description: 'Legacy database nije pronađena' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.legacyDatabasesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('settings.legacy_databases.update')
  @ApiOperation({ summary: 'Ažuriranje legacy database konfiguracije' })
  @ApiParam({ name: 'id', description: 'ID legacy database' })
  @ApiResponse({ status: 200, description: 'Legacy database je uspešno ažurirana' })
  @ApiResponse({ status: 404, description: 'Legacy database nije pronađena' })
  @ApiResponse({ status: 403, description: 'Nemate dozvolu za ažuriranje' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLegacyDatabaseDto: UpdateLegacyDatabaseDto,
  ) {
    return this.legacyDatabasesService.update(id, updateLegacyDatabaseDto);
  }

  @Delete(':id')
  @RequirePermissions('settings.legacy_databases.delete')
  @ApiOperation({ summary: 'Brisanje legacy database konfiguracije' })
  @ApiParam({ name: 'id', description: 'ID legacy database' })
  @ApiResponse({ status: 200, description: 'Legacy database je uspešno obrisana' })
  @ApiResponse({ status: 404, description: 'Legacy database nije pronađena' })
  @ApiResponse({ status: 403, description: 'Nemate dozvolu za brisanje' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.legacyDatabasesService.remove(id);
  }

  @Post(':id/test-connection')
  @RequirePermissions('settings.legacy_databases.read')
  @ApiOperation({ summary: 'Testiranje konekcije sa legacy database' })
  @ApiParam({ name: 'id', description: 'ID legacy database' })
  @ApiResponse({ status: 200, description: 'Rezultat testiranja konekcije' })
  @ApiResponse({ status: 404, description: 'Legacy database nije pronađena' })
  testConnection(@Param('id', ParseIntPipe) id: number) {
    return this.legacyDatabasesService.testConnection(id);
  }

  @Post('test-connection')
  @RequirePermissions('settings.legacy_databases.read')
  @ApiOperation({ summary: 'Testiranje konekcije sa proizvoljnim parametrima' })
  @ApiResponse({ status: 200, description: 'Rezultat testiranja konekcije' })
  testCustomConnection(@Body() testConnectionDto: TestConnectionDto) {
    return this.legacyDatabasesService.testDatabaseConnection(testConnectionDto);
  }
}