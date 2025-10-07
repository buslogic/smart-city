import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaterMeterManufacturerDto } from './dto/create-water-meter-manufacturer.dto';
import { UpdateWaterMeterManufacturerDto } from './dto/update-water-meter-manufacturer.dto';
import { SearchManufacturerDto } from './dto/search-manufacturer.dto';

@Injectable()
export class WaterMeterManufacturersService {
  constructor(private prisma: PrismaService) {}

  private readonly PAGE_LIMIT = 50;

  async findAll() {
    return this.prisma.waterMeterManufacturer.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const manufacturer = await this.prisma.waterMeterManufacturer.findUnique({
      where: { id },
    });

    if (!manufacturer) {
      throw new NotFoundException(`Proizvođač sa ID ${id} nije pronađen`);
    }

    return manufacturer;
  }

  async create(createDto: CreateWaterMeterManufacturerDto) {
    const created = await this.prisma.waterMeterManufacturer.create({
      data: createDto,
    });
    return this.findOne(created.id);
  }

  async update(id: number, updateDto: UpdateWaterMeterManufacturerDto) {
    await this.findOne(id);

    await this.prisma.waterMeterManufacturer.update({
      where: { id },
      data: updateDto,
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.waterMeterManufacturer.delete({
      where: { id },
    });
    return { success: true };
  }

  async searchForList(searchDto: SearchManufacturerDto) {
    const { query = '', pageNumber = 0 } = searchDto;
    const offset = pageNumber * this.PAGE_LIMIT;

    const where = query
      ? {
          OR: [
            { manufacturer: { contains: query } },
            { id: isNaN(Number(query)) ? undefined : Number(query) },
          ],
        }
      : {};

    const [manufacturers, total] = await Promise.all([
      this.prisma.waterMeterManufacturer.findMany({
        where,
        select: {
          id: true,
          manufacturer: true,
        },
        orderBy: { id: 'asc' },
        skip: offset,
        take: this.PAGE_LIMIT,
      }),
      this.prisma.waterMeterManufacturer.count({ where }),
    ]);

    const data = manufacturers.map((m) => `${m.id} | ${m.manufacturer.trim()}`);
    const hasMore = offset + this.PAGE_LIMIT < total;

    return { data, hasMore };
  }
}
