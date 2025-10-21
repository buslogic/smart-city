import { Controller, Post, Body } from '@nestjs/common';
import { ReadingAnomaliesService } from './reading-anomalies.service';
import { CreateReadingAnomalyDto } from './dto/create-reading-anomaly.dto';
import { UpdateReadingAnomalyDto } from './dto/update-reading-anomaly.dto';

@Controller('reading-anomalies')
export class ReadingAnomaliesController {
  constructor(private readonly service: ReadingAnomaliesService) {}

  @Post('getRows')
  findAll() {
    return this.service.findAll();
  }

  @Post('addRow')
  create(@Body() createDto: CreateReadingAnomalyDto) {
    return this.service.create(createDto);
  }

  @Post('editRow')
  update(@Body() data: { id: number; [key: string]: any }) {
    const { id, ...updateDto } = data;
    return this.service.update(id, updateDto as UpdateReadingAnomalyDto);
  }

  @Post('deleteRow')
  delete(@Body() data: { id: number }) {
    return this.service.delete(data.id);
  }
}
