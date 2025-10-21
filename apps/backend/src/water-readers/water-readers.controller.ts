import { Controller, Post, Body } from '@nestjs/common';
import { WaterReadersService } from './water-readers.service';
import { CreateWaterReaderDto } from './dto/create-water-reader.dto';
import { UpdateWaterReaderDto } from './dto/update-water-reader.dto';

@Controller('water-readers')
export class WaterReadersController {
  constructor(private readonly service: WaterReadersService) {}

  @Post('getRows')
  findAll() {
    return this.service.findAll();
  }

  @Post('getrowbyid')
  findOne(@Body() data: { id: number }) {
    return this.service.findOne(data.id);
  }

  @Post('getRegionsForSL')
  getRegionsForSL(@Body() data: { query?: string; pageNumber?: number }) {
    return this.service.getRegionsForSL(data);
  }

  @Post('getAddressesForSL')
  getAddressesForSL(
    @Body() data: { query?: string; pageNumber?: number; region_id?: number },
  ) {
    return this.service.getAddressesForSL(data);
  }

  @Post('getReaderRegions')
  getReaderRegions(@Body() data: { reader_id: number }) {
    return this.service.getReaderRegions(data.reader_id);
  }

  @Post('getReaderAddresses')
  getReaderAddresses(@Body() data: { reader_id: number }) {
    return this.service.getReaderAddresses(data.reader_id);
  }

  @Post('assignReaderRegion')
  assignReaderRegion(@Body() data: { id: number; region_ids: number[] }) {
    return this.service
      .assignReaderRegion(data.id, data.region_ids)
      .then((success) => ({ success }));
  }

  @Post('assignReaderAddress')
  assignReaderAddress(@Body() data: { id: number; address_ids: number[] }) {
    return this.service
      .assignReaderAddress(data.id, data.address_ids)
      .then((success) => ({ success }));
  }

  @Post('removeReaderRegion')
  removeReaderRegion(@Body() data: { reader_id: number; id: number }) {
    return this.service
      .removeReaderRegion(data.reader_id, data.id)
      .then((success) => ({ success }));
  }

  @Post('removeReaderAddress')
  removeReaderAddress(@Body() data: { reader_id: number; id: number }) {
    return this.service
      .removeReaderAddress(data.reader_id, data.id)
      .then((success) => ({ success }));
  }

  @Post('addRow')
  create(@Body() createDto: CreateWaterReaderDto) {
    return this.service.create(createDto);
  }

  @Post('editRow')
  update(@Body() data: { id: number; [key: string]: any }) {
    const { id, ...updateDto } = data;
    return this.service.update(id, updateDto as UpdateWaterReaderDto);
  }

  @Post('deleteRow')
  delete(@Body() data: { id: number }) {
    return this.service.delete(data.id);
  }
}
