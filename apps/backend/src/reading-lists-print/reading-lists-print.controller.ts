import { Controller, Post, Body } from '@nestjs/common';
import { ReadingListsPrintService } from './reading-lists-print.service';

@Controller('reading-lists-print')
export class ReadingListsPrintController {
  constructor(private readonly service: ReadingListsPrintService) {}

  @Post('getRegionsForSL')
  getRegionsForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.service.getRegionsForSL(data);
  }

  @Post('getAddressesForSL')
  getAddressesForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.service.getAddressesForSL(data);
  }

  @Post('getReadersForSL')
  getReadersForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.service.getReadersForSL(data);
  }

  @Post('getRows')
  getRows(@Body() params: { id?: string; type?: string; date?: string }) {
    return this.service.getRows(params);
  }
}
