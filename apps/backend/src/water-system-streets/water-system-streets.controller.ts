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
import { WaterSystemStreetsService } from './water-system-streets.service';
import { CreateWaterSystemStreetDto } from './dto/create-water-system-street.dto';
import { UpdateWaterSystemStreetDto } from './dto/update-water-system-street.dto';
import type { Response as ExpressResponse } from 'express';

@Controller('water-system-streets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterSystemStreetsController {
  constructor(private readonly waterSystemStreetsService: WaterSystemStreetsService) {}

  @Get()
  @RequirePermissions('water_system_streets:read')
  async findAll() {
    return this.waterSystemStreetsService.findAll();
  }

  @Get('search-list')
  @RequirePermissions('water_system_streets:read')
  async getAddressesForSL(@Query('query') query: string = '', @Query('pageNumber') pageNumber: string = '0') {
    return this.waterSystemStreetsService.getAddressesForSL(query, parseInt(pageNumber));
  }

  @Post('search-list')
  @RequirePermissions('water_system_streets:read')
  async getAddressesForSLPost(@Body() body: { query?: string; pageNumber?: number }) {
    const query = body.query || '';
    const pageNumber = body.pageNumber || 0;
    return this.waterSystemStreetsService.getAddressesForSL(query, pageNumber);
  }

  @Get('cities/search-list')
  @RequirePermissions('water_system_streets:read')
  async getCitiesForSL(@Query('query') query: string = '', @Query('pageNumber') pageNumber: string = '0') {
    return this.waterSystemStreetsService.getCitiesForSL(query, parseInt(pageNumber));
  }

  @Post('cities/search-list')
  @RequirePermissions('water_system_streets:read')
  async getCitiesForSLPost(@Body() body: { query?: string; pageNumber?: number }) {
    const query = body.query || '';
    const pageNumber = body.pageNumber || 0;
    return this.waterSystemStreetsService.getCitiesForSL(query, pageNumber);
  }

  @Get('export-csv')
  @RequirePermissions('water_system_streets:read')
  async exportCSV(@Res() res: ExpressResponse) {
    const data = await this.waterSystemStreetsService.exportCSV();

    if (!data || data.length === 0) {
      return res.status(404).send('No data to export.');
    }

    const csv = this.convertToCSV(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Ulice.csv"');
    res.send(csv);
  }

  @Post('import-csv')
  @RequirePermissions('water_system_streets:create')
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

    return this.waterSystemStreetsService.bulkInsert(data);
  }

  @Get(':id')
  @RequirePermissions('water_system_streets:read')
  async findOne(@Param('id') id: string) {
    return this.waterSystemStreetsService.findOne(+id);
  }

  @Post()
  @RequirePermissions('water_system_streets:create')
  async create(@Body() createDto: CreateWaterSystemStreetDto) {
    const data = await this.waterSystemStreetsService.create(createDto);
    return { success: !!data, data };
  }

  @Put(':id')
  @RequirePermissions('water_system_streets:update')
  async update(@Param('id') id: string, @Body() updateDto: UpdateWaterSystemStreetDto) {
    const data = await this.waterSystemStreetsService.update(+id, updateDto);
    return { success: !!data, data };
  }

  @Delete(':id')
  @RequirePermissions('water_system_streets:delete')
  async remove(@Param('id') id: string) {
    return this.waterSystemStreetsService.remove(+id);
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
