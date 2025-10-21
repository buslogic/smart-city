import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BillingCampaignsService } from './billing-campaigns.service';
import { CheckPeriodDto } from './dto/check-period.dto';
import { SearchItemsDto } from './dto/search-items.dto';
import { AddRowDto } from './dto/add-row.dto';
import { EditRowDto } from './dto/edit-row.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('billing-campaigns')
@UseGuards(JwtAuthGuard)
export class BillingCampaignsController {
  constructor(
    private readonly billingCampaignsService: BillingCampaignsService,
  ) {}

  @Post('getData')
  async getData(@Body() dto: CheckPeriodDto) {
    return this.billingCampaignsService.getData(dto);
  }

  @Post('checkOpenAccountingPeriod')
  async checkOpenAccountingPeriod(@Body() dto: CheckPeriodDto) {
    return this.billingCampaignsService.checkOpenAccountingPeriod(dto);
  }

  @Post('getWaterMeters')
  async getWaterMeters(@Body() dto: SearchItemsDto) {
    return this.billingCampaignsService.getWaterMeters(dto);
  }

  @Post('getMeasuringPoints')
  async getMeasuringPoints(@Body() dto: SearchItemsDto) {
    return this.billingCampaignsService.getMeasuringPoints(dto);
  }

  @Post('getWaterMeterReadings')
  async getWaterMeterReadings(@Body() dto: SearchItemsDto) {
    return this.billingCampaignsService.getWaterMeterReadings(dto);
  }

  @Post('addNewRow')
  async addNewRow(@Body() dto: AddRowDto) {
    return this.billingCampaignsService.addNewRow(dto);
  }

  @Post('createNewCalculation')
  async createNewCalculation(@Body() dto: CheckPeriodDto) {
    return this.billingCampaignsService.createNewCalculation(dto);
  }

  @Post('closeAccountingPeriod')
  async closeAccountingPeriod(@Body() dto: CheckPeriodDto) {
    return this.billingCampaignsService.closeAccountingPeriod(dto);
  }

  @Post('editRow')
  async editRow(@Body() dto: EditRowDto) {
    return this.billingCampaignsService.editRow(dto);
  }
}
