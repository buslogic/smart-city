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
import { LegacyTableMappingsService } from './legacy-table-mappings.service';
import { CreateTableMappingDto } from './dto/create-table-mapping.dto';
import { UpdateTableMappingDto } from './dto/update-table-mapping.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Legacy Table Mappings')
@ApiBearerAuth()
@Controller('legacy-table-mappings')
export class LegacyTableMappingsController {
  constructor(
    private readonly legacyTableMappingsService: LegacyTableMappingsService,
  ) {}

  @Post()
  @RequirePermissions('legacy_tables:create')
  @ApiOperation({ summary: 'Kreiranje novog mapiranja tabela' })
  @ApiResponse({ status: 201, description: 'Mapiranje je uspešno kreirano' })
  @ApiResponse({ status: 403, description: 'Nemate dozvolu za kreiranje' })
  create(@Body() createTableMappingDto: CreateTableMappingDto) {
    return this.legacyTableMappingsService.create(createTableMappingDto);
  }

  @Get()
  @RequirePermissions('legacy_tables:read')
  @ApiOperation({ summary: 'Dohvatanje svih mapiranja tabela' })
  @ApiResponse({ status: 200, description: 'Lista mapiranja' })
  findAll() {
    return this.legacyTableMappingsService.findAll();
  }

  @Get('legacy-tables/:databaseId')
  @RequirePermissions('legacy_tables:read')
  @ApiOperation({ summary: 'Dohvatanje tabela iz legacy baze' })
  @ApiParam({ name: 'databaseId', description: 'ID legacy baze' })
  @ApiResponse({ status: 200, description: 'Lista tabela' })
  getLegacyTables(@Param('databaseId', ParseIntPipe) databaseId: number) {
    return this.legacyTableMappingsService.getLegacyTables(databaseId);
  }

  @Get('local-tables')
  @RequirePermissions('legacy_tables:read')
  @ApiOperation({ summary: 'Dohvatanje lokalnih tabela' })
  @ApiResponse({ status: 200, description: 'Lista lokalnih tabela' })
  getLocalTables() {
    return this.legacyTableMappingsService.getLocalTables();
  }

  @Get(':id')
  @RequirePermissions('legacy_tables:read')
  @ApiOperation({ summary: 'Dohvatanje mapiranja po ID-u' })
  @ApiParam({ name: 'id', description: 'ID mapiranja' })
  @ApiResponse({ status: 200, description: 'Podaci o mapiranju' })
  @ApiResponse({ status: 404, description: 'Mapiranje nije pronađeno' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.legacyTableMappingsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('legacy_tables:update')
  @ApiOperation({ summary: 'Ažuriranje mapiranja tabela' })
  @ApiParam({ name: 'id', description: 'ID mapiranja' })
  @ApiResponse({ status: 200, description: 'Mapiranje je uspešno ažurirano' })
  @ApiResponse({ status: 404, description: 'Mapiranje nije pronađeno' })
  @ApiResponse({ status: 403, description: 'Nemate dozvolu za ažuriranje' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTableMappingDto: UpdateTableMappingDto,
  ) {
    return this.legacyTableMappingsService.update(id, updateTableMappingDto);
  }

  @Delete(':id')
  @RequirePermissions('legacy_tables:delete')
  @ApiOperation({ summary: 'Brisanje mapiranja tabela' })
  @ApiParam({ name: 'id', description: 'ID mapiranja' })
  @ApiResponse({ status: 200, description: 'Mapiranje je uspešno obrisano' })
  @ApiResponse({ status: 404, description: 'Mapiranje nije pronađeno' })
  @ApiResponse({ status: 403, description: 'Nemate dozvolu za brisanje' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.legacyTableMappingsService.remove(id);
  }
}
