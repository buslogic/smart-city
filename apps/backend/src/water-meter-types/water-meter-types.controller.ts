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
import { WaterMeterTypesService } from './water-meter-types.service';
import { CreateWaterMeterTypeDto } from './dto/create-water-meter-type.dto';
import { UpdateWaterMeterTypeDto } from './dto/update-water-meter-type.dto';
import { SearchTypeDto } from './dto/search-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Water Meter Types')
@ApiBearerAuth()
@Controller('water-meter-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterMeterTypesController {
  constructor(
    private readonly waterMeterTypesService: WaterMeterTypesService,
  ) {}

  @Get()
  @RequirePermissions('water_meter_types:view')
  @ApiOperation({ summary: 'Vraća sve tipove vodomera' })
  findAll() {
    return this.waterMeterTypesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('water_meter_types:view')
  @ApiOperation({ summary: 'Vraća tip vodomera po ID-u' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.waterMeterTypesService.findOne(id);
  }

  @Post()
  @RequirePermissions('water_meter_types:create')
  @ApiOperation({ summary: 'Kreira novi tip vodomera' })
  create(@Body() createWaterMeterTypeDto: CreateWaterMeterTypeDto) {
    return this.waterMeterTypesService.create(createWaterMeterTypeDto);
  }

  @Patch(':id')
  @RequirePermissions('water_meter_types:update')
  @ApiOperation({ summary: 'Ažurira tip vodomera' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWaterMeterTypeDto: UpdateWaterMeterTypeDto,
  ) {
    return this.waterMeterTypesService.update(id, updateWaterMeterTypeDto);
  }

  @Delete(':id')
  @RequirePermissions('water_meter_types:delete')
  @ApiOperation({ summary: 'Briše tip vodomera' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.waterMeterTypesService.remove(id);
  }

  @Post('search')
  @RequirePermissions('water_meter_types:view')
  @ApiOperation({ summary: 'Pretraži tipove za SearchList komponentu' })
  searchForList(@Body() searchDto: SearchTypeDto) {
    return this.waterMeterTypesService.searchForList(
      searchDto.query,
      searchDto.pageNumber,
      searchDto.limit,
    );
  }
}
