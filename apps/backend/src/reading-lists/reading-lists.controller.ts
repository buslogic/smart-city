import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ReadingListsService } from './reading-lists.service';
import { CreateReadingListDto } from './dto/create-reading-list.dto';
import { UpdateReadingListDto } from './dto/update-reading-list.dto';

@Controller('reading-lists')
export class ReadingListsController {
  constructor(private readonly readingListsService: ReadingListsService) {}

  @Post('getRows')
  findAll() {
    return this.readingListsService.findAll();
  }

  @Post('getStatusForSL')
  getStatusForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.readingListsService.getStatusForSL(data);
  }

  @Post('getSubCampaignForSL')
  getSubCampaignForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.readingListsService.getSubCampaignForSL(data);
  }

  @Post('addRow')
  create(@Body() createReadingListDto: CreateReadingListDto) {
    return this.readingListsService.create(createReadingListDto);
  }

  @Post('editRow')
  update(@Body() updateData: UpdateReadingListDto & { id: number }) {
    const { id, ...data } = updateData;
    return this.readingListsService.update(id, data);
  }

  @Post('deleteRow')
  remove(@Body() data: { id: number }) {
    return this.readingListsService.remove(data.id);
  }

  @Post('archiveRow')
  archive(@Body() data: { id: number }) {
    return this.readingListsService.archive(data.id);
  }
}
