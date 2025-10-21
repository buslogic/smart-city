import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ReadingsService } from './readings.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingDto } from './dto/update-reading.dto';

@Controller('readings')
export class ReadingsController {
  constructor(private readonly readingsService: ReadingsService) {}

  @Post('getRows')
  findAll() {
    return this.readingsService.findAll();
  }

  @Post('getStatusForSL')
  getStatusForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.readingsService.getStatusForSL(data);
  }

  @Post('getReaderForSL')
  getReaderForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.readingsService.getReaderForSL(data);
  }

  @Post('getReadingItemForSL')
  getReadingItemForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.readingsService.getReadingItemForSL(data);
  }

  @Post('getReadingSourceForSL')
  getReadingSourceForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.readingsService.getReadingSourceForSL(data);
  }

  @Post('getSubCampaignForSL')
  getSubCampaignForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.readingsService.getSubCampaignForSL(data);
  }

  @Post('getMeasuringPoints')
  getMeasuringPoints(
    @Body() data: { query?: string; pageNumber?: number },
    @Query('campaignId') campaignId?: string,
  ) {
    return this.readingsService.getMeasuringPoints(
      data,
      30,
      campaignId ? parseInt(campaignId) : undefined,
    );
  }

  @Post('getWaterMeter')
  getWaterMeter(
    @Body() data: { query?: string; pageNumber?: number },
    @Query('idmm') idmm?: string,
  ) {
    return this.readingsService.getWaterMeter(
      data,
      30,
      idmm ? parseInt(idmm) : undefined,
    );
  }

  @Post('addRow')
  create(@Body() createReadingDto: CreateReadingDto) {
    return this.readingsService.create(createReadingDto);
  }

  @Post('editRow')
  update(@Body() updateReadingDto: UpdateReadingDto & { id: number }) {
    const { id, ...data } = updateReadingDto;
    return this.readingsService.update(id, data);
  }

  @Post('deleteRow')
  remove(@Body() data: { id: number }) {
    return this.readingsService.remove(data.id);
  }
}
