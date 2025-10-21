import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CashiersService } from './cashiers.service';
import { CreateCashierDto } from './dto/create-cashier.dto';
import { UpdateCashierDto } from './dto/update-cashier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cashiers')
@UseGuards(JwtAuthGuard)
export class CashiersController {
  constructor(private readonly cashiersService: CashiersService) {}

  @Post('getAll')
  async getAll() {
    return this.cashiersService.getAll();
  }

  @Post('getUnusedCashierCrmContactsForSL')
  async getUnusedCashierCrmContactsForSL(@Body() dto: { query?: string; pageNumber?: number }) {
    return this.cashiersService.getUnusedCashierCrmContactsForSL(dto);
  }

  @Post('addRow')
  async addRow(@Body() createDto: CreateCashierDto) {
    return this.cashiersService.create(createDto);
  }

  @Post('editRow')
  async editRow(@Body() body: any) {
    const { id, ...updateDto } = body;
    return this.cashiersService.update(id, updateDto);
  }

  @Post('deleteRow')
  async deleteRow(@Body() body: { id: number }) {
    return this.cashiersService.delete(body.id);
  }
}
