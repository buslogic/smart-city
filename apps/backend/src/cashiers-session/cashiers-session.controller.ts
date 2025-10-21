import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CashiersSessionService } from './cashiers-session.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cashiers-session')
@UseGuards(JwtAuthGuard)
export class CashiersSessionController {
  constructor(private readonly service: CashiersSessionService) {}

  @Post('getByID')
  async getByID(@Body() body: { session_id: number }) {
    const data = await this.service.getByID(body.session_id);
    return { success: !!data, data };
  }

  @Post('isSessionOpen')
  async isSessionOpen(@Request() req) {
    const userId = req.user.id;
    const res = await this.service.isSessionOpen(userId);
    return res;
  }

  @Post('getCashierSession')
  async getCashierSession(@Request() req) {
    const userId = req.user.id;
    const data = await this.service.getCashierSession(userId);
    return { success: true, data };
  }

  @Post('openSession')
  async openSession(@Body() dto: OpenSessionDto, @Request() req) {
    const userId = req.user.id;
    const data = await this.service.openSession(userId, dto);
    return { success: !!data, data };
  }

  @Post('getAllTransactionsForSession')
  async getAllTransactionsForSession(
    @Body() body: { datum_otvaranja: string },
    @Request() req,
  ) {
    const userId = req.user.id;
    const data = await this.service.getAllTransactionsForSession(
      userId,
      body.datum_otvaranja,
    );
    return { success: !!data, data };
  }

  @Post('closeSession')
  async closeSession(@Body() dto: CloseSessionDto, @Request() req) {
    const userId = req.user.id;
    const data = await this.service.closeSession(userId, dto);
    return { success: !!data, data };
  }
}
