import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
} from '@nestjs/common';
import { SubsidiesService } from './subsidies.service';
import { SearchSubsidiesDto } from './dto/search-subsidies.dto';
import { SearchItemsDto } from './dto/search-items.dto';
import { AddSubsidyDto } from './dto/add-subsidy.dto';
import { EditSubsidyDto } from './dto/edit-subsidy.dto';
import { DeleteSubsidyDto } from './dto/delete-subsidy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('subsidies')
@UseGuards(JwtAuthGuard)
export class SubsidiesController {
  constructor(private readonly subsidiesService: SubsidiesService) {}

  @Post('getRows')
  async getRows(@Body() dto: SearchSubsidiesDto) {
    return this.subsidiesService.getRows(dto);
  }

  @Post('getTypesForSL')
  async getTypesForSL(@Body() dto: SearchItemsDto) {
    return this.subsidiesService.getTypesForSL(dto);
  }

  @Post('getStatusForSL')
  async getStatusForSL(@Body() dto: SearchItemsDto) {
    return this.subsidiesService.getStatusForSL(dto);
  }

  @Post('getSubsidiesForSL')
  async getSubsidiesForSL(@Body() dto: SearchItemsDto) {
    return this.subsidiesService.getSubsidiesForSL(dto);
  }

  @Get('getActiveSubsidies')
  async getActiveSubsidies() {
    return this.subsidiesService.getActiveSubsidies();
  }

  @Post('addRow')
  async addRow(@Body() dto: AddSubsidyDto, @Request() req) {
    const userId = req.user.id;
    return this.subsidiesService.addRow(dto, userId);
  }

  @Post('deleteRow')
  async deleteRow(@Body() dto: DeleteSubsidyDto, @Request() req) {
    const userId = req.user.id;
    return this.subsidiesService.deleteRow(dto, userId);
  }

  @Post('editRow')
  async editRow(@Body() dto: EditSubsidyDto, @Request() req) {
    const userId = req.user.id;
    return this.subsidiesService.editRow(dto, userId);
  }

  @Post('history/:subsidyId')
  async getSubsidiesHistory(@Param('subsidyId') subsidyId: string) {
    return this.subsidiesService.getSubsidiesHistory(parseInt(subsidyId, 10));
  }
}
