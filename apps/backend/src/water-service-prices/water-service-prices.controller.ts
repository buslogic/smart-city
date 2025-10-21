import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WaterServicePricesService } from './water-service-prices.service';
import { CreateWaterServicePriceDto } from './dto/create-water-service-price.dto';
import { UpdateWaterServicePriceDto } from './dto/update-water-service-price.dto';
import { SearchServicePriceDto } from './dto/search-service-price.dto';
import { GetHistoryDto } from './dto/get-history.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Water Service Prices')
@ApiBearerAuth()
@Controller('water-service-prices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterServicePricesController {
  constructor(
    private readonly waterServicePricesService: WaterServicePricesService,
  ) {}

  @Get()
  @RequirePermissions('water_service_prices:view')
  @ApiOperation({ summary: 'Vraća cenovnik vodovod usluga' })
  @ApiQuery({ name: 'category_id', required: false, description: 'ID kategorije potrošača' })
  findAll(@Query('category_id') categoryId?: string) {
    const parsedCategoryId = categoryId ? parseInt(categoryId, 10) : undefined;
    return this.waterServicePricesService.findAll(parsedCategoryId);
  }

  @Get(':id')
  @RequirePermissions('water_service_prices:view')
  @ApiOperation({ summary: 'Vraća stavku cenovnika po ID-u' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.waterServicePricesService.findOne(id);
  }

  @Post()
  @RequirePermissions('water_service_prices:create')
  @ApiOperation({ summary: 'Kreira novu stavku cenovnika' })
  create(@Body() createDto: CreateWaterServicePriceDto) {
    return this.waterServicePricesService.create(createDto);
  }

  @Patch(':id')
  @RequirePermissions('water_service_prices:update')
  @ApiOperation({ summary: 'Ažurira stavku cenovnika' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateWaterServicePriceDto,
  ) {
    return this.waterServicePricesService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('water_service_prices:delete')
  @ApiOperation({ summary: 'Briše stavku cenovnika (soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.waterServicePricesService.remove(id);
  }

  @Post('search-categories')
  @RequirePermissions('water_service_prices:view')
  @ApiOperation({ summary: 'Pretraži kategorije za SearchList komponentu' })
  searchCategories(@Body() searchDto: SearchServicePriceDto) {
    return this.waterServicePricesService.searchCategoriesForList(
      searchDto.query,
      searchDto.pageNumber,
      searchDto.limit,
    );
  }

  @Post('history')
  @RequirePermissions('water_service_prices_history:view')
  @ApiOperation({ summary: 'Vraća istoriju promena cenovnika po ID-u' })
  getHistory(@Body() dto: GetHistoryDto) {
    return this.waterServicePricesService.getPricelistHistory(
      dto.pricelist_id,
      dto.start_date,
      dto.end_date,
    );
  }

  @Post('search-pricelist-services')
  @RequirePermissions('water_service_prices:view')
  @ApiOperation({
    summary: 'Pretraži cenovnik usluga za SearchList komponentu',
  })
  searchPricelistServices(@Body() searchDto: SearchServicePriceDto) {
    return this.waterServicePricesService.searchPricelistServicesForList(
      searchDto.query,
      searchDto.pageNumber,
      searchDto.limit,
    );
  }

  @Get('by-measuring-point/:idmm')
  @RequirePermissions('water_services_review:view')
  @ApiOperation({ summary: 'Vraća cenovnik usluga za merno mesto' })
  getPricelistsByMeasuringPoint(@Param('idmm', ParseIntPipe) idmm: number) {
    return this.waterServicePricesService.getPricelistsByMeasuringPoint(idmm);
  }
}
