import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FiscalDeviceService } from './fiscal-device.service';
import { CreateFiscalDeviceDto } from './dto/create-fiscal-device.dto';
import { UpdateFiscalDeviceDto } from './dto/update-fiscal-device.dto';
import { SearchDto } from './dto/search-fiscal-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('fiscal-device')
@UseGuards(JwtAuthGuard)
export class FiscalDeviceController {
  constructor(private readonly fiscalDeviceService: FiscalDeviceService) {}

  @Post('getRows')
  async getRows() {
    return this.fiscalDeviceService.getRows();
  }

  @Post('getStatusForSL')
  async getStatusForSL(@Body() dto: SearchDto) {
    return this.fiscalDeviceService.getStatusForSL(dto);
  }

  @Post('addRow')
  async addRow(@Body() createDto: CreateFiscalDeviceDto, @Request() req) {
    return this.fiscalDeviceService.create(createDto, req.user.id);
  }

  @Post('editRow')
  async editRow(@Body() body: any, @Request() req) {
    const { id, ...updateDto } = body;
    return this.fiscalDeviceService.update(id, updateDto, req.user.id);
  }

  @Post('deleteRow')
  async deleteRow(@Body() body: { id: number }) {
    return this.fiscalDeviceService.delete(body.id);
  }
}
