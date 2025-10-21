import { Controller, Post, Body } from '@nestjs/common';
import { WaterMeterCalculationService } from './water-meter-calculation.service';
import { GetRowsDto } from './dto/get-rows.dto';

@Controller('water-meter-calculation')
export class WaterMeterCalculationController {
  constructor(private readonly service: WaterMeterCalculationService) {}

  @Post('getRows')
  async getRows(@Body() dto: GetRowsDto) {
    return this.service.getRows(dto.year, dto.month);
  }
}
