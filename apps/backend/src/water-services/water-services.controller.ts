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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WaterServicesService } from './water-services.service';
import { CreateWaterServiceDto } from './dto/create-water-service.dto';
import { UpdateWaterServiceDto } from './dto/update-water-service.dto';
import { SearchServiceDto } from './dto/search-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Water Services')
@ApiBearerAuth()
@Controller('water-services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterServicesController {
  constructor(private readonly waterServicesService: WaterServicesService) {}

  @Get()
  @RequirePermissions('water_services:view')
  @ApiOperation({ summary: 'Vraća sve vodovod usluge' })
  findAll() {
    return this.waterServicesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('water_services:view')
  @ApiOperation({ summary: 'Vraća vodovod uslugu po ID-u' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.waterServicesService.findOne(id);
  }

  @Post()
  @RequirePermissions('water_services:create')
  @ApiOperation({ summary: 'Kreira novu vodovod uslugu' })
  create(@Body() createWaterServiceDto: CreateWaterServiceDto) {
    return this.waterServicesService.create(createWaterServiceDto);
  }

  @Patch(':id')
  @RequirePermissions('water_services:update')
  @ApiOperation({ summary: 'Ažurira vodovod uslugu' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWaterServiceDto: UpdateWaterServiceDto,
  ) {
    return this.waterServicesService.update(id, updateWaterServiceDto);
  }

  @Delete(':id')
  @RequirePermissions('water_services:delete')
  @ApiOperation({ summary: 'Briše vodovod uslugu' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.waterServicesService.remove(id);
  }

  @Post('search')
  @RequirePermissions('water_services:view')
  @ApiOperation({ summary: 'Pretraži usluge za SearchList komponentu' })
  searchForList(@Body() searchDto: SearchServiceDto) {
    return this.waterServicesService.searchForList(
      searchDto.query,
      searchDto.pageNumber,
      searchDto.limit,
    );
  }
}
