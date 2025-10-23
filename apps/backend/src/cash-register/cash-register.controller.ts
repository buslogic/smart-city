import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { CreateCashRegisterDto } from './dto/create-cash-register.dto';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';
import { SearchDto } from './dto/search-cash-register.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cash-register')
@UseGuards(JwtAuthGuard)
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Post('get-rows')
  async getRows() {
    return this.cashRegisterService.getRows();
  }

  @Post('get-status-for-sl')
  async getStatusForSL(@Body() dto: SearchDto) {
    return this.cashRegisterService.getStatusForSL(dto);
  }

  @Post('get-fiscal-device-for-sl')
  async getFiscalDeviceForSL(@Body() dto: SearchDto) {
    return this.cashRegisterService.getFiscalDeviceForSL(dto);
  }

  @Post('get-cash-register-for-sl')
  async getCashRegisterForSL(@Body() dto: SearchDto) {
    return this.cashRegisterService.getCashRegisterForSL(dto);
  }

  @Post('add-row')
  async addRow(@Body() createDto: CreateCashRegisterDto, @Request() req) {
    return this.cashRegisterService.create(createDto, req.user.id);
  }

  @Post('edit-row')
  async editRow(@Body() body: any, @Request() req) {
    const { id, ...updateDto } = body;
    return this.cashRegisterService.update(id, updateDto, req.user.id);
  }

  @Post('delete-row')
  async deleteRow(@Body() body: { id: number }) {
    return this.cashRegisterService.delete(body.id);
  }

  @Post('getCashRegisterReport')
  async getCashRegisterReport(@Body() body: { start_date?: string; end_date?: string }) {
    return this.cashRegisterService.getCashRegisterReport(body.start_date, body.end_date);
  }

  @Post('getPaymentsByPaymentMethod')
  async getPaymentsByPaymentMethod(@Body() body: { id: number }, @Request() req) {
    return this.cashRegisterService.getPaymentsByPaymentMethod(req.user.id, body.id);
  }

  @Get('is-session-open')
  async isSessionOpen(@Request() req) {
    const isOpen = await this.cashRegisterService.isSessionOpen(req.user.id);
    return isOpen;
  }
}

