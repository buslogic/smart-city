import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaterMeterRemarkDto } from './dto/create-water-meter-remark.dto';
import { UpdateWaterMeterRemarkDto } from './dto/update-water-meter-remark.dto';

@Injectable()
export class WaterMeterRemarksService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.waterMeterReading.findMany({
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const remark = await this.prisma.waterMeterReading.findUnique({
      where: { id },
    });

    if (!remark) {
      throw new NotFoundException(`Očitavanje vodomera sa ID ${id} nije pronađeno`);
    }

    return remark;
  }

  async create(createDto: CreateWaterMeterRemarkDto) {
    const created = await this.prisma.waterMeterReading.create({
      data: {
        ...createDto,
        faulty: createDto.faulty === 1,
        unreadable: createDto.unreadable === 1,
        notFoundOnSite: createDto.notFoundOnSite === 1,
        noMeter: createDto.noMeter === 1,
        negativeConsumption: createDto.negativeConsumption === 1,
        transferToNextCl: createDto.transferToNextCl === 1,
        billPrintout: createDto.billPrintout === 1,
        canceled: createDto.canceled === 1,
        priority: createDto.priority === 1,
        average: createDto.average === 1,
        meterReaderOnly: createDto.meterReaderOnly === 1,
        disconnected: createDto.disconnected === 1,
        censusSelect: createDto.censusSelect === 1,
      },
    });
    return this.findOne(created.id);
  }

  async update(id: number, updateDto: UpdateWaterMeterRemarkDto) {
    await this.findOne(id);

    const data: any = {};

    // Konvertuj number u boolean za boolean polja
    if (updateDto.faulty !== undefined) data.faulty = updateDto.faulty === 1;
    if (updateDto.unreadable !== undefined) data.unreadable = updateDto.unreadable === 1;
    if (updateDto.notFoundOnSite !== undefined) data.notFoundOnSite = updateDto.notFoundOnSite === 1;
    if (updateDto.noMeter !== undefined) data.noMeter = updateDto.noMeter === 1;
    if (updateDto.negativeConsumption !== undefined) data.negativeConsumption = updateDto.negativeConsumption === 1;
    if (updateDto.transferToNextCl !== undefined) data.transferToNextCl = updateDto.transferToNextCl === 1;
    if (updateDto.billPrintout !== undefined) data.billPrintout = updateDto.billPrintout === 1;
    if (updateDto.canceled !== undefined) data.canceled = updateDto.canceled === 1;
    if (updateDto.priority !== undefined) data.priority = updateDto.priority === 1;
    if (updateDto.average !== undefined) data.average = updateDto.average === 1;
    if (updateDto.meterReaderOnly !== undefined) data.meterReaderOnly = updateDto.meterReaderOnly === 1;
    if (updateDto.disconnected !== undefined) data.disconnected = updateDto.disconnected === 1;
    if (updateDto.censusSelect !== undefined) data.censusSelect = updateDto.censusSelect === 1;

    // Dodaj string polja
    if (updateDto.meterReading !== undefined) data.meterReading = updateDto.meterReading;
    if (updateDto.note !== undefined) data.note = updateDto.note;
    if (updateDto.userAccount !== undefined) data.userAccount = updateDto.userAccount;
    if (updateDto.availability !== undefined) data.availability = updateDto.availability;

    await this.prisma.waterMeterReading.update({
      where: { id },
      data,
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.waterMeterReading.delete({
      where: { id },
    });
    return { success: true };
  }
}
