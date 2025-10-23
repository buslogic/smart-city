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
} from '@nestjs/common';
import { HouseCouncilService } from './house-council.service';
import { CreateHouseCouncilDto } from './dto/create-house-council.dto';
import { UpdateHouseCouncilDto } from './dto/update-house-council.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('house-council')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HouseCouncilController {
  constructor(private readonly houseCouncilService: HouseCouncilService) {}

  @Post()
  @RequirePermissions('house_council:create')
  create(@Body() createDto: CreateHouseCouncilDto) {
    return this.houseCouncilService.create(createDto);
  }

  @Get()
  @RequirePermissions('house_council:view')
  findAll() {
    return this.houseCouncilService.findAll();
  }

  @Post('search/measuring-points')
  @RequirePermissions('house_council:view')
  searchMeasuringPoints(
    @Body() body: { query?: string; pageNumber?: number },
  ) {
    return this.houseCouncilService.searchMeasuringPoints(
      body.query,
      body.pageNumber ?? 0,
    );
  }

  @Post('search/addresses')
  @RequirePermissions('house_council:view')
  searchAddresses(
    @Body() body: { query?: string; pageNumber?: number },
  ) {
    return this.houseCouncilService.searchAddresses(
      body.query,
      body.pageNumber ?? 0,
    );
  }

  @Post('search/cities')
  @RequirePermissions('house_council:view')
  searchCities(
    @Body() body: { query?: string; pageNumber?: number },
  ) {
    return this.houseCouncilService.searchCities(
      body.query,
      body.pageNumber ?? 0,
    );
  }

  @Get(':id')
  @RequirePermissions('house_council:view')
  findOne(@Param('id') id: string) {
    return this.houseCouncilService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermissions('house_council:edit')
  update(@Param('id') id: string, @Body() updateDto: UpdateHouseCouncilDto) {
    return this.houseCouncilService.update(+id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('house_council:delete')
  remove(@Param('id') id: string) {
    return this.houseCouncilService.remove(+id);
  }
}
