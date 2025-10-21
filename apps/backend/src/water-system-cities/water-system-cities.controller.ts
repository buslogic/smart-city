import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { WaterSystemCitiesService } from './water-system-cities.service';
import { CreateWaterSystemCityDto } from './dto/create-water-system-city.dto';
import { UpdateWaterSystemCityDto } from './dto/update-water-system-city.dto';

@Controller('water-system-cities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaterSystemCitiesController {
  constructor(private readonly waterSystemCitiesService: WaterSystemCitiesService) {}

  @Get()
  @RequirePermissions('water_system_cities:read')
  async findAll() {
    return this.waterSystemCitiesService.findAll();
  }

  @Get('export-csv')
  @RequirePermissions('water_system_cities:read')
  async exportCSV(@Res() res: ExpressResponse) {
    const data = await this.waterSystemCitiesService.exportCSV();

    if (!data || data.length === 0) {
      return res.status(404).send('No data to export.');
    }

    const csv = this.convertToCSV(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Gradovi.csv"');
    res.send(csv);
  }

  @Post('import-csv')
  @RequirePermissions('water_system_cities:create')
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

    return this.waterSystemCitiesService.bulkInsert(data);
  }

  @Get(':id')
  @RequirePermissions('water_system_cities:read')
  async findOne(@Param('id') id: string) {
    return this.waterSystemCitiesService.findOne(+id);
  }

  @Post()
  @RequirePermissions('water_system_cities:create')
  async create(@Body() createDto: CreateWaterSystemCityDto) {
    const data = await this.waterSystemCitiesService.create(createDto);
    return { success: !!data, data };
  }

  @Put(':id')
  @RequirePermissions('water_system_cities:update')
  async update(@Param('id') id: string, @Body() updateDto: UpdateWaterSystemCityDto) {
    const data = await this.waterSystemCitiesService.update(+id, updateDto);
    return { success: !!data, data };
  }

  @Delete(':id')
  @RequirePermissions('water_system_cities:delete')
  async remove(@Param('id') id: string) {
    return this.waterSystemCitiesService.remove(+id);
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
