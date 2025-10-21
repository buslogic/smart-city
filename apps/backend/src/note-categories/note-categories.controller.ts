import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NoteCategoriesService } from './note-categories.service';
import { CreateNoteCategoryDto } from './dto/create-note-category.dto';
import { UpdateNoteCategoryDto } from './dto/update-note-category.dto';
import { SearchCategoryDto } from './dto/search-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Note Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('note-categories')
export class NoteCategoriesController {
  constructor(private readonly service: NoteCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvati sve kategorije' })
  @ApiResponse({ status: 200, description: 'Lista kategorija' })
  @RequirePermissions('note_categories:view')
  findAll() {
    return this.service.findAll();
  }

  @Post('search')
  @ApiOperation({ summary: 'Pretraži kategorije' })
  @ApiResponse({ status: 200, description: 'Lista kategorija' })
  @RequirePermissions('note_categories:view')
  searchCategories(@Body() searchDto: SearchCategoryDto) {
    return this.service.searchCategories(searchDto, 10);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dohvati kategoriju po ID-u' })
  @ApiResponse({ status: 200, description: 'Kategorija' })
  @ApiResponse({ status: 404, description: 'Kategorija nije pronađena' })
  @RequirePermissions('note_categories:view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kreiraj novu kategoriju' })
  @ApiResponse({ status: 201, description: 'Kategorija kreirana' })
  @RequirePermissions('note_categories:create')
  create(@Body() createDto: CreateNoteCategoryDto) {
    return this.service.create(createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriraj kategoriju' })
  @ApiResponse({ status: 200, description: 'Kategorija ažurirana' })
  @ApiResponse({ status: 404, description: 'Kategorija nije pronađena' })
  @RequirePermissions('note_categories:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateNoteCategoryDto) {
    return this.service.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Obriši kategoriju' })
  @ApiResponse({ status: 200, description: 'Kategorija obrisana' })
  @ApiResponse({ status: 404, description: 'Kategorija nije pronađena' })
  @RequirePermissions('note_categories:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
