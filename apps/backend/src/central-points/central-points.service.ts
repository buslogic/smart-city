import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { CreateCentralPointDto } from './dto/create-central-point.dto';
import { UpdateCentralPointDto } from './dto/update-central-point.dto';
import { createConnection } from 'mysql2/promise';

@Injectable()
export class CentralPointsService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  // ========== GLAVNI SERVER (NAŠA BAZA) ==========

  async create(createCentralPointDto: CreateCentralPointDto) {
    return this.prisma.centralPoint.create({
      data: {
        ...createCentralPointDto,
        dateTime: new Date(), // Automatski setuj trenutno vreme
      },
    });
  }

  async findAllMain() {
    return this.prisma.centralPoint.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const centralPoint = await this.prisma.centralPoint.findUnique({
      where: { id },
    });

    if (!centralPoint) {
      throw new NotFoundException(`Centralna tačka sa ID ${id} nije pronađena`);
    }

    return centralPoint;
  }

  async update(id: number, updateCentralPointDto: UpdateCentralPointDto) {
    await this.findOne(id); // Proverava da li postoji

    return this.prisma.centralPoint.update({
      where: { id },
      data: updateCentralPointDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Proverava da li postoji

    return this.prisma.centralPoint.delete({
      where: { id },
    });
  }

  // ========== TIKETING SERVER (LEGACY BAZA) ==========

  async findAllTicketing() {
    return this.findAllFromLegacy('main_ticketing_database');
  }

  // ========== GRADSKI SERVER (LEGACY BAZA) ==========

  async findAllCity() {
    return this.findAllFromLegacy('city_ticketing_database');
  }

  // ========== HELPER METODE ==========

  private async findAllFromLegacy(subtype: string) {
    try {
      // Pronađi legacy bazu prema subtype-u
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          `Legacy baza sa subtype "${subtype}" nije pronađena`,
        );
      }

      // Dekriptuj password
      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      // Kreiraj konekciju
      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        // Učitaj sve central points iz legacy baze
        const [rows] = await connection.execute(
          'SELECT * FROM central_points ORDER BY id DESC',
        );

        return rows;
      } finally {
        // Uvek zatvori konekciju
        await connection.end();
      }
    } catch (error) {
      console.error(`Greška pri učitavanju iz legacy baze (${subtype}):`, error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }
}
