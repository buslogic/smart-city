import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { CreateTableMappingDto } from './dto/create-table-mapping.dto';
import { UpdateTableMappingDto } from './dto/update-table-mapping.dto';
import { createConnection } from 'mysql2/promise';
import { Client } from 'pg';

@Injectable()
export class LegacyTableMappingsService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  async create(createTableMappingDto: CreateTableMappingDto) {
    // Verify that legacy database exists
    const legacyDb = await this.prisma.legacyDatabase.findUnique({
      where: { id: createTableMappingDto.legacyDatabaseId },
    });

    if (!legacyDb) {
      throw new NotFoundException(
        `Legacy database sa ID ${createTableMappingDto.legacyDatabaseId} nije pronađena`,
      );
    }

    // Check if mapping already exists
    const existingMapping = await this.prisma.legacyTableMapping.findFirst({
      where: {
        legacyDatabaseId: createTableMappingDto.legacyDatabaseId,
        legacyTableName: createTableMappingDto.legacyTableName,
        localTableName: createTableMappingDto.localTableName,
      },
    });

    if (existingMapping) {
      throw new BadRequestException(
        'Mapiranje za ovu kombinaciju tabela već postoji',
      );
    }

    return this.prisma.legacyTableMapping.create({
      data: createTableMappingDto,
      include: {
        legacyDatabase: true,
      },
    });
  }

  async findAll() {
    return this.prisma.legacyTableMapping.findMany({
      include: {
        legacyDatabase: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const mapping = await this.prisma.legacyTableMapping.findUnique({
      where: { id },
      include: {
        legacyDatabase: true,
      },
    });

    if (!mapping) {
      throw new NotFoundException(`Table mapping sa ID ${id} nije pronađen`);
    }

    return mapping;
  }

  async update(id: number, updateTableMappingDto: UpdateTableMappingDto) {
    await this.findOne(id); // Check if exists

    return this.prisma.legacyTableMapping.update({
      where: { id },
      data: updateTableMappingDto,
      include: {
        legacyDatabase: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Check if exists

    await this.prisma.legacyTableMapping.delete({
      where: { id },
    });

    return { message: `Table mapping sa ID ${id} je uspešno obrisan` };
  }

  // Get tables from legacy database
  async getLegacyTables(legacyDatabaseId: number) {
    const legacyDb = await this.prisma.legacyDatabase.findUnique({
      where: { id: legacyDatabaseId },
    });

    if (!legacyDb) {
      throw new NotFoundException(
        `Legacy database sa ID ${legacyDatabaseId} nije pronađena`,
      );
    }

    // Decrypt password for connection
    const decryptedPassword = this.legacyDatabasesService.decryptPassword(
      legacyDb.password,
    );

    try {
      switch (legacyDb.type) {
        case 'mysql':
          return await this.getMySQLTables(legacyDb, decryptedPassword);
        case 'postgresql':
          return await this.getPostgreSQLTables(legacyDb, decryptedPassword);
        default:
          throw new BadRequestException(
            `Tip baze "${legacyDb.type}" nije podržan za listing tabela`,
          );
      }
    } catch (error) {
      throw new BadRequestException(
        `Greška pri dobavljanju tabela: ${error.message}`,
      );
    }
  }

  private async getMySQLTables(legacyDb: any, password: string) {
    const connection = await createConnection({
      host: legacyDb.host,
      port: legacyDb.port,
      user: legacyDb.username,
      password: password,
      database: legacyDb.database,
    });

    try {
      const [rows] = await connection.execute('SHOW TABLES');
      const tables = (rows as any[]).map((row: any) => Object.values(row)[0]);
      await connection.end();
      return tables;
    } catch (error) {
      await connection.end();
      throw error;
    }
  }

  private async getPostgreSQLTables(legacyDb: any, password: string) {
    const client = new Client({
      host: legacyDb.host,
      port: legacyDb.port,
      user: legacyDb.username,
      password: password,
      database: legacyDb.database,
    });

    try {
      await client.connect();
      const result = await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      );
      const tables = result.rows.map((row) => row.tablename);
      await client.end();
      return tables;
    } catch (error) {
      await client.end();
      throw error;
    }
  }

  // Get local tables from our database
  async getLocalTables() {
    try {
      const tables = await this.prisma.$queryRaw<any[]>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      return tables.map((t: any) => t.table_name || t.TABLE_NAME);
    } catch (error) {
      throw new BadRequestException(
        `Greška pri dobavljanju lokalnih tabela: ${error.message}`,
      );
    }
  }
}
