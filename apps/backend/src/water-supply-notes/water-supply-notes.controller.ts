import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WaterSupplyNotesService } from './water-supply-notes.service';
import { CreateWaterSupplyNoteDto } from './dto/create-water-supply-note.dto';
import { UpdateWaterSupplyNoteDto } from './dto/update-water-supply-note.dto';
import { SearchCategoryDto } from './dto/search-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Water Supply Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('water-supply-notes')
export class WaterSupplyNotesController {
  constructor(private readonly service: WaterSupplyNotesService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvati sve beleške' })
  @ApiResponse({ status: 200, description: 'Lista beleški' })
  @RequirePermissions('water_supply_notes:view')
  findAll() {
    return this.service.findAll();
  }

  @Post('categories/search')
  @ApiOperation({ summary: 'Pretraži kategorije beleški' })
  @ApiResponse({ status: 200, description: 'Lista kategorija' })
  @RequirePermissions('water_supply_notes:view')
  searchCategories(@Body() searchDto: SearchCategoryDto) {
    return this.service.searchCategories(searchDto, 10);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dohvati belešku po ID-u' })
  @ApiResponse({ status: 200, description: 'Beleška' })
  @ApiResponse({ status: 404, description: 'Beleška nije pronađena' })
  @RequirePermissions('water_supply_notes:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kreiraj novu belešku' })
  @ApiResponse({ status: 201, description: 'Beleška kreirana' })
  @RequirePermissions('water_supply_notes:create')
  create(@Body() createDto: CreateWaterSupplyNoteDto, @CurrentUser() user: any) {
    // Automatski postavi authorId na trenutnog korisnika
    if (!createDto.authorId && user?.id) {
      createDto.authorId = user.id;
    }
    return this.service.create(createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriraj belešku' })
  @ApiResponse({ status: 200, description: 'Beleška ažurirana' })
  @ApiResponse({ status: 404, description: 'Beleška nije pronađena' })
  @RequirePermissions('water_supply_notes:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateWaterSupplyNoteDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Obriši belešku (soft delete)' })
  @ApiResponse({ status: 200, description: 'Beleška obrisana' })
  @ApiResponse({ status: 404, description: 'Beleška nije pronađena' })
  @RequirePermissions('water_supply_notes:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
