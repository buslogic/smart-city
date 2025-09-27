import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserGroupDto } from './dto/create-user-group.dto';
import { UpdateUserGroupDto } from './dto/update-user-group.dto';
import { Prisma } from '@prisma/client';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { createConnection, Connection } from 'mysql2/promise';

@Injectable()
export class UserGroupsService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  async findAll(filters: {
    includeInactive?: boolean;
    driver?: boolean;
    userClass?: number;
  }) {
    const where: Prisma.UserGroupWhereInput = {};

    if (!filters.includeInactive) {
      where.isActive = true;
    }

    if (filters.driver !== undefined) {
      where.driver = filters.driver;
    }

    if (filters.userClass !== undefined) {
      where.userClass = filters.userClass;
    }

    return this.prisma.userGroup.findMany({
      where,
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        groupName: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const userGroup = await this.prisma.userGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!userGroup) {
      throw new NotFoundException(`User group with ID ${id} not found`);
    }

    return userGroup;
  }

  async create(createUserGroupDto: CreateUserGroupDto) {
    try {
      // Proveri da li userClass je između 1 i 20
      if (
        createUserGroupDto.userClass &&
        (createUserGroupDto.userClass < 1 || createUserGroupDto.userClass > 20)
      ) {
        throw new BadRequestException('User class must be between 1 and 20');
      }

      return await this.prisma.userGroup.create({
        data: createUserGroupDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('User group with this name already exists');
      }
      throw error;
    }
  }

  async update(id: number, updateUserGroupDto: UpdateUserGroupDto) {
    // Proveri da li grupa postoji
    await this.findOne(id);

    // Proveri da li userClass je između 1 i 20
    if (
      updateUserGroupDto.userClass !== undefined &&
      (updateUserGroupDto.userClass < 1 || updateUserGroupDto.userClass > 20)
    ) {
      throw new BadRequestException('User class must be between 1 and 20');
    }

    try {
      return await this.prisma.userGroup.update({
        where: { id },
        data: updateUserGroupDto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('User group with this name already exists');
      }
      throw error;
    }
  }

  async remove(id: number) {
    // Proveri da li grupa postoji
    const userGroup = await this.findOne(id);

    // Proveri da li ima korisnika u grupi
    const usersCount = await this.prisma.user.count({
      where: { userGroupId: id },
    });

    if (usersCount > 0) {
      throw new ConflictException(
        `Cannot delete user group with ${usersCount} users. Remove users first.`,
      );
    }

    return this.prisma.userGroup.delete({
      where: { id },
    });
  }

  async getUsersInGroup(groupId: number) {
    // Proveri da li grupa postoji
    await this.findOne(groupId);

    return this.prisma.user.findMany({
      where: { userGroupId: groupId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async addUserToGroup(groupId: number, userId: number) {
    // Proveri da li grupa postoji
    await this.findOne(groupId);

    // Proveri da li korisnik postoji
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.userGroupId === groupId) {
      throw new ConflictException('User is already in this group');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { userGroupId: groupId },
      include: {
        userGroup: true,
      },
    });
  }

  async removeUserFromGroup(groupId: number, userId: number) {
    // Proveri da li korisnik postoji i pripada grupi
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.userGroupId !== groupId) {
      throw new BadRequestException('User is not in this group');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { userGroupId: null },
    });
  }

  async updateSyncStatus(updates: { id: number; syncEnabled: boolean; legacyId?: number }[]) {
    const results: any[] = [];

    for (const update of updates) {
      try {
        const updateData: any = { syncEnabled: update.syncEnabled };

        // Add legacyId if provided and syncEnabled is true
        if (update.syncEnabled && update.legacyId) {
          updateData.legacyId = update.legacyId;
        } else if (!update.syncEnabled) {
          // Clear legacyId if sync is disabled
          updateData.legacyId = null;
        }

        const updated = await this.prisma.userGroup.update({
          where: { id: update.id },
          data: updateData,
        });
        results.push({ id: update.id, success: true, data: updated });
      } catch (error) {
        results.push({ id: update.id, success: false, error: error.message });
      }
    }

    return results;
  }

  async fetchLegacyUserGroups() {
    // Pronađi mapiranje za user_groups tabelu
    const mapping = await this.prisma.legacyTableMapping.findFirst({
      where: {
        localTableName: 'user_groups',
        syncEnabled: true,
      },
      include: {
        legacyDatabase: true,
      },
    });

    if (!mapping) {
      // Proveri da li postoji mapiranje ali je sync_enabled = false
      const disabledMapping = await this.prisma.legacyTableMapping.findFirst({
        where: {
          localTableName: 'user_groups',
        },
        include: {
          legacyDatabase: true,
        },
      });

      if (disabledMapping) {
        throw new BadRequestException(
          'Mapiranje za user_groups tabelu postoji ali sinhronizacija nije omogućena. ' +
          'Molimo omogućite sinhronizaciju u podešavanjima Legacy tabela.',
        );
      }

      throw new NotFoundException(
        'Mapiranje za user_groups tabelu nije pronađeno. ' +
        'Molimo konfigurite mapiranje u podešavanjima Legacy tabela.',
      );
    }

    let connection: Connection | null = null;

    try {
      // Konektuj se na legacy bazu
      const password = this.legacyDatabasesService.decryptPassword(
        mapping.legacyDatabase.password,
      );

      connection = await createConnection({
        host: mapping.legacyDatabase.host,
        port: mapping.legacyDatabase.port,
        user: mapping.legacyDatabase.username,
        password: password,
        database: mapping.legacyDatabase.database,
      });

      // Čitaj podatke iz legacy tabele
      const [rows] = await connection.execute(
        `SELECT * FROM ${mapping.legacyTableName} ORDER BY id`,
      );

      // Formatiraj podatke
      const legacyGroups = (rows as any[]).map(row => ({
        id: row.id,
        groupName: row.group_name || row.name || '',
        driver: row.driver === 1 || row.driver === true,
        userClass: row.user_class || 1,
        description: row.description || null,
        isActive: row.is_active === undefined ? true : (row.is_active === 1 || row.is_active === true),
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        // Dodatna polja iz legacy baze koja mogu biti korisna
        legacyData: {
          ...row
        }
      }));

      return {
        source: {
          database: mapping.legacyDatabase.database,
          host: mapping.legacyDatabase.host,
          table: mapping.legacyTableName,
        },
        totalRecords: legacyGroups.length,
        data: legacyGroups,
      };

    } catch (error) {
      console.error('Error fetching legacy user groups:', error);
      throw new BadRequestException(
        `Greška pri čitanju podataka iz legacy baze: ${error.message}`,
      );
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }
}