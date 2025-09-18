import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(createVehicleDto: CreateVehicleDto) {
    // Proveri da li već postoji vozilo sa istim garažnim brojem
    const existingVehicle = await this.prisma.busVehicle.findUnique({
      where: { garageNumber: createVehicleDto.garageNumber },
    });

    if (existingVehicle) {
      throw new ConflictException(
        `Vozilo sa garažnim brojem ${createVehicleDto.garageNumber} već postoji`,
      );
    }

    // Ako postoji legacyId, proveri da li je jedinstven
    if (createVehicleDto.legacyId) {
      const existingLegacy = await this.prisma.busVehicle.findUnique({
        where: { legacyId: createVehicleDto.legacyId },
      });

      if (existingLegacy) {
        throw new ConflictException(
          `Vozilo sa legacy ID ${createVehicleDto.legacyId} već postoji`,
        );
      }
    }

    return this.prisma.busVehicle.create({
      data: createVehicleDto,
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    active?: boolean,
    vehicleType?: number,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { garageNumber: { contains: search } },
        { registrationNumber: { contains: search } },
        { vehicleNumber: { contains: search } },
        { chassisNumber: { contains: search } },
      ];
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    const [vehicles, total] = await Promise.all([
      this.prisma.busVehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { garageNumber: 'asc' },
      }),
      this.prisma.busVehicle.count({ where }),
    ]);

    return {
      data: vehicles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const vehicle = await this.prisma.busVehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vozilo sa ID ${id} nije pronađeno`);
    }

    return vehicle;
  }

  async update(id: number, updateVehicleDto: UpdateVehicleDto) {
    const vehicle = await this.findOne(id);

    // Ako se menja garažni broj, proveri da li je jedinstven
    if (
      updateVehicleDto.garageNumber &&
      updateVehicleDto.garageNumber !== vehicle.garageNumber
    ) {
      const existingVehicle = await this.prisma.busVehicle.findUnique({
        where: { garageNumber: updateVehicleDto.garageNumber },
      });

      if (existingVehicle) {
        throw new ConflictException(
          `Vozilo sa garažnim brojem ${updateVehicleDto.garageNumber} već postoji`,
        );
      }
    }

    // Ako se menja legacyId, proveri da li je jedinstven
    if (
      updateVehicleDto.legacyId &&
      updateVehicleDto.legacyId !== vehicle.legacyId
    ) {
      const existingLegacy = await this.prisma.busVehicle.findUnique({
        where: { legacyId: updateVehicleDto.legacyId },
      });

      if (existingLegacy) {
        throw new ConflictException(
          `Vozilo sa legacy ID ${updateVehicleDto.legacyId} već postoji`,
        );
      }
    }

    return this.prisma.busVehicle.update({
      where: { id },
      data: updateVehicleDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.busVehicle.delete({
      where: { id },
    });

    return { message: `Vozilo sa ID ${id} je uspešno obrisano` };
  }

  // Dodatne korisne metode

  async findByGarageNumber(garageNumber: string) {
    const vehicle = await this.prisma.busVehicle.findUnique({
      where: { garageNumber },
    });

    if (!vehicle) {
      throw new NotFoundException(
        `Vozilo sa garažnim brojem ${garageNumber} nije pronađeno`,
      );
    }

    return vehicle;
  }

  async findByLegacyId(legacyId: number) {
    const vehicle = await this.prisma.busVehicle.findUnique({
      where: { legacyId },
    });

    if (!vehicle) {
      throw new NotFoundException(
        `Vozilo sa legacy ID ${legacyId} nije pronađeno`,
      );
    }

    return vehicle;
  }

  async getStatistics() {
    const [total, active, inactive, byType, byFuelType, withWifi, withAC] =
      await Promise.all([
        this.prisma.busVehicle.count(),
        this.prisma.busVehicle.count({ where: { active: true } }),
        this.prisma.busVehicle.count({ where: { active: false } }),
        this.prisma.busVehicle.groupBy({
          by: ['vehicleType'],
          _count: true,
        }),
        this.prisma.busVehicle.groupBy({
          by: ['fuelType'],
          _count: true,
        }),
        this.prisma.busVehicle.count({ where: { wifi: true } }),
        this.prisma.busVehicle.count({ where: { airCondition: true } }),
      ]);

    return {
      total,
      active,
      inactive,
      byType: byType.map((item) => ({
        type: item.vehicleType,
        count: item._count,
      })),
      byFuelType: byFuelType.map((item) => ({
        fuelType: item.fuelType,
        count: item._count,
      })),
      withWifi,
      withAirCondition: withAC,
    };
  }

  async getExpiringDocuments(days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const [expiringTechnical, expiringRegistration] = await Promise.all([
      this.prisma.busVehicle.findMany({
        where: {
          technicalControlTo: {
            lte: futureDate,
            gte: new Date(),
          },
          active: true,
        },
        select: {
          id: true,
          garageNumber: true,
          registrationNumber: true,
          technicalControlTo: true,
        },
      }),
      this.prisma.busVehicle.findMany({
        where: {
          registrationValidTo: {
            lte: futureDate,
            gte: new Date(),
          },
          active: true,
        },
        select: {
          id: true,
          garageNumber: true,
          registrationNumber: true,
          registrationValidTo: true,
        },
      }),
    ]);

    return {
      expiringTechnicalControl: expiringTechnical,
      expiringRegistration: expiringRegistration,
    };
  }

  async exportForGps() {
    // Dohvati samo aktivna vozila sa potrebnim podacima za GPS
    const vehicles = await this.prisma.busVehicle.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        garageNumber: true,
      },
      orderBy: {
        garageNumber: 'asc',
      },
    });

    // Mapiraj u format potreban legacy sistemu, filtriraj null vrednosti
    return vehicles
      .filter((v) => v.garageNumber !== null)
      .map((v) => ({
        id: v.id,
        garageNumber: v.garageNumber,
      }));
  }
}
