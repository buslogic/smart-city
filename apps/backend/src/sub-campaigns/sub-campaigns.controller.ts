import { Controller, Post, Body } from '@nestjs/common';
import { SubCampaignsService } from './sub-campaigns.service';
import { CreateSubCampaignDto } from './dto/create-sub-campaign.dto';
import { UpdateSubCampaignDto } from './dto/update-sub-campaign.dto';
import { SearchQueryDto } from './dto/search-query.dto';

@Controller('sub-campaigns')
export class SubCampaignsController {
  constructor(private readonly service: SubCampaignsService) {}

  @Post('getRows')
  async getRows() {
    return this.service.getRows();
  }

  @Post('getCampaignForSL')
  async getCampaignForSL(@Body() searchDto: SearchQueryDto) {
    return this.service.getCampaignForSL(searchDto);
  }

  @Post('getStatusForSL')
  async getStatusForSL(@Body() searchDto: SearchQueryDto) {
    return this.service.getStatusForSL(searchDto);
  }

  @Post('getRegionForSL')
  async getRegionForSL(@Body() searchDto: SearchQueryDto) {
    return this.service.getRegionForSL(searchDto);
  }

  @Post('getCitacForSL')
  async getCitacForSL(@Body() searchDto: SearchQueryDto) {
    return this.service.getCitacForSL(searchDto);
  }

  @Post('addRow')
  async addRow(@Body() createDto: CreateSubCampaignDto) {
    return this.service.addRow(createDto);
  }

  @Post('editRow')
  async editRow(@Body() updateDto: UpdateSubCampaignDto) {
    const { id, ...data } = updateDto;
    return this.service.editRow(id, data as UpdateSubCampaignDto);
  }

  @Post('deleteRow')
  async deleteRow(@Body() body: { id: number }) {
    return this.service.deleteRow(body.id);
  }
}
