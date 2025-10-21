import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { SearchPaymentDto, SearchCurrencyDto } from './dto/search-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('get-payment-data')
  async getPaymentData(@Body() dto: SearchPaymentDto, @Request() req) {
    return this.paymentsService.getPaymentData(dto.payer_id, req.user.id);
  }

  @Post('get-inactive-payment-data')
  async getInactivePaymentData(@Body() dto: SearchPaymentDto, @Request() req) {
    return this.paymentsService.getInactivePaymentData(dto.payer_id, req.user.id);
  }

  @Post('get-currency-for-sl')
  async getCurrencyForSL(@Body() dto: SearchCurrencyDto) {
    return this.paymentsService.getCurrencyForSL(dto);
  }

  @Post('get-cash-register')
  async getCashRegister(@Request() req) {
    const result = await this.paymentsService.getCashRegister(req.user.id);
    if (result) {
      return { id: result.id, name: result.name };
    }
    return { error: 'User not found' };
  }

  @Post('add-row')
  async addRow(@Body() createPaymentDto: CreatePaymentDto, @Request() req) {
    return this.paymentsService.create(createPaymentDto, req.user.id);
  }

  @Post('edit-row')
  async editRow(@Body() body: any, @Request() req) {
    const { id, ...updatePaymentDto } = body;
    return this.paymentsService.update(id, updatePaymentDto, req.user.id);
  }

  @Post('delete-row')
  async deleteRow(@Body() body: { id: number }) {
    return this.paymentsService.delete(body.id);
  }
}
