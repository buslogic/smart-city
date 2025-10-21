import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { WaterSystemRegionsService } from './water-system-regions.service';
import { CreateWaterSystemRegionDto } from './dto/create-water-system-region.dto';
import { UpdateWaterSystemRegionDto } from './dto/update-water-system-region.dto';
import type { Response as ExpressResponse } from 'express';

@Controller('water-system-regions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterSystemRegionsController {
  constructor(private readonly waterSystemRegionsService: WaterSystemRegionsService) {}

  @Get()
  @RequirePermissions('water_system_regions:read')
  async findAll() {
    return this.waterSystemRegionsService.findAll();
  }

  @Get('search-list')
  @RequirePermissions('water_system_regions:read')
  async getRegionsForSL(@Query('query') query: string = '', @Query('pageNumber') pageNumber: string = '0') {
    return this.waterSystemRegionsService.getRegionsForSL(query, parseInt(pageNumber));
  }

  @Post('search-list')
  @RequirePermissions('water_system_regions:read')
  async getRegionsForSLPost(@Body() body: { query?: string; pageNumber?: number }) {
    const query = body.query || '';
    const pageNumber = body.pageNumber || 0;
    return this.waterSystemRegionsService.getRegionsForSL(query, pageNumber);
  }

  @Get('streets/:regionId')
  @RequirePermissions('water_system_regions:read')
  async getStreetsByRegion(@Param('regionId') regionId: string) {
    return this.waterSystemRegionsService.getStreetsByRegion(parseInt(regionId));
  }

  @Get('export-csv')
  @RequirePermissions('water_system_regions:read')
  async exportCSV(@Res() res: ExpressResponse) {
    const data = await this.waterSystemRegionsService.exportCSV();

    if (!data || data.length === 0) {
      return res.status(404).send('No data to export.');
    }

    const csv = this.convertToCSV(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Rejoni.csv"');
    res.send(csv);
  }

  @Post('import-csv')
  @RequirePermissions('water_system_regions:create')
  @UseInterceptors(FileInterceptor('csvFile'))
  async importCSV(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { success: false, error: 'No file uploaded' };
    }

    const csvData = file.buffer.toString('utf-8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    const data = lines.slice(1).map(line => {
      const values = line.split(',');
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index]?.trim();
      });
      return obj;
    });

    return this.waterSystemRegionsService.bulkInsert(data);
  }

  @Get(':id')
  @RequirePermissions('water_system_regions:read')
  async findOne(@Param('id') id: string) {
    return this.waterSystemRegionsService.findOne(+id);
  }

  @Post()
  @RequirePermissions('water_system_regions:create')
  async create(@Body() createDto: CreateWaterSystemRegionDto) {
    const data = await this.waterSystemRegionsService.create(createDto);
    return { success: !!data, data };
  }

  @Put(':id')
  @RequirePermissions('water_system_regions:update')
  async update(@Param('id') id: string, @Body() updateDto: UpdateWaterSystemRegionDto) {
    const data = await this.waterSystemRegionsService.update(+id, updateDto);
    return { success: !!data, data };
  }

  @Delete(':id')
  @RequirePermissions('water_system_regions:delete')
  async remove(@Param('id') id: string) {
    return this.waterSystemRegionsService.remove(+id);
  }

  @Delete('streets/:streetId')
  @RequirePermissions('water_system_regions:update')
  async removeStreet(@Param('streetId') streetId: string) {
    return this.waterSystemRegionsService.removeStreet(+streetId);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return value !== null && value !== undefined ? String(value) : '';
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}
