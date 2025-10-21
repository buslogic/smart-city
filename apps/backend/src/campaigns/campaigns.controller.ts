import { Controller, Post, Body } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { SearchQueryDto } from './dto/search-query.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Post('getRows')
  async getRows() {
    return this.service.getRows();
  }

  @Post('checkIfCampaignExists')
  async checkIfCampaignExists(
    @Body() body: { godina: number; mesec: number },
  ) {
    return this.service.checkIfCampaignExists(body.godina, body.mesec);
  }

  @Post('getStatusForSL')
  async getStatusForSL(@Body() searchDto: SearchQueryDto) {
    return this.service.getStatusForSL(searchDto);
  }

  @Post('addRow')
  async addRow(@Body() createDto: CreateCampaignDto) {
    return this.service.addRow(createDto);
  }

  @Post('editRow')
  async editRow(@Body() updateDto: UpdateCampaignDto) {
    const { id, ...data } = updateDto;
    return this.service.editRow(id, data as UpdateCampaignDto);
  }

  @Post('deleteRow')
  async deleteRow(@Body() body: { id: number }) {
    return this.service.deleteRow(body.id);
  }
}
