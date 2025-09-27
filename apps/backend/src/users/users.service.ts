import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { MailService } from '../mail/mail.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { createConnection, Connection } from 'mysql2/promise';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Automatski generiši sigurnu lozinku
    const temporaryPassword = this.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const { roles, ...userData } = createUserDto;

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        userGroup: true,
      },
    });

    // Assign roles if provided
    if (roles && roles.length > 0) {
      for (const roleName of roles) {
        const role = await this.prisma.role.findUnique({
          where: { name: roleName },
        });

        if (role) {
          await this.prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: role.id,
            },
          });
        }
      }

      // Fetch updated user with roles
      const updatedUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
          userGroup: true,
        },
      });

      // Pošalji welcome email
      try {
        await this.mailService.sendWelcomeEmail({
          email: updatedUser!.email,
          firstName: updatedUser!.firstName,
          lastName: updatedUser!.lastName,
          temporaryPassword,
        });
        this.logger.log(`Welcome email sent to ${updatedUser!.email}`);
      } catch (error) {
        this.logger.error(
          `Failed to send welcome email to ${updatedUser!.email}:`,
          error,
        );
        // Ne prekidamo proces ako email ne prođe
      }

      return new UserResponseDto(updatedUser!);
    }

    // Pošalji welcome email (ako nema role)
    try {
      await this.mailService.sendWelcomeEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        temporaryPassword,
      });
      this.logger.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${user.email}:`,
        error,
      );
      // Ne prekidamo proces ako email ne prođe
    }

    return new UserResponseDto(user);
  }

  async findAll(page = 1, pageSize = 10, search?: string) {
    const skip = (page - 1) * pageSize;

    const where = search
      ? {
          OR: [
            { email: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
          userGroup: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => new UserResponseDto(user)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        userGroup: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return new UserResponseDto(user);
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (emailExists) {
        throw new ConflictException('User with this email already exists');
      }
    }

    const { roles, ...userData } = updateUserDto;

    const user = await this.prisma.user.update({
      where: { id },
      data: userData,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        userGroup: true,
      },
    });

    // Update roles if provided
    if (roles !== undefined) {
      // Remove all existing roles
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      // Add new roles
      if (roles.length > 0) {
        for (const roleName of roles) {
          const role = await this.prisma.role.findUnique({
            where: { name: roleName },
          });

          if (role) {
            await this.prisma.userRole.create({
              data: {
                userId: id,
                roleId: role.id,
              },
            });
          }
        }
      }

      // Fetch updated user with roles
      const updatedUser = await this.prisma.user.findUnique({
        where: { id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
          userGroup: true,
        },
      });

      return new UserResponseDto(updatedUser);
    }

    return new UserResponseDto(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Delete user roles first (due to foreign key constraints)
    await this.prisma.userRole.deleteMany({
      where: { userId: id },
    });

    // Delete user sessions
    await this.prisma.session.deleteMany({
      where: { userId: id },
    });

    // Finally delete the user
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async toggleStatus(id: number, isActive: boolean): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        userGroup: true,
      },
    });

    return new UserResponseDto(updatedUser);
  }

  async updateProfile(id: number, data: { avatar?: string | null }) {
    // Ako je development i briše se avatar, obriši i lokalnu sliku
    if (process.env.NODE_ENV === 'development' && data.avatar === null) {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { avatar: true },
      });

      if (user?.avatar && user.avatar.includes('/uploads/avatars/')) {
        const filename = user.avatar.split('/').pop();
        if (filename) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(
            process.cwd(),
            'uploads',
            'avatars',
            filename,
          );
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        avatar: data.avatar,
      },
    });
  }

  async findOneWithDetails(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        userGroup: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  private generateSecurePassword(): string {
    const length = 12;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+-=';
    let password = '';

    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%&*+-='[Math.floor(Math.random() * 10)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  async getAllEmails(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      select: { email: true },
    });
    return users.map(u => u.email);
  }

  async getExistingUsersForSync(): Promise<{ emails: string[], legacyIds: number[] }> {
    const users = await this.prisma.user.findMany({
      select: {
        email: true,
        legacyId: true
      },
    });
    return {
      emails: users.map(u => u.email.toLowerCase()),
      legacyIds: users.filter(u => u.legacyId !== null).map(u => u.legacyId as number)
    };
  }

  async fetchLegacyUsers() {
    // First get user groups that are enabled for sync and have legacyId
    const syncEnabledGroups = await this.prisma.userGroup.findMany({
      where: {
        syncEnabled: true,
        legacyId: { not: null }
      },
      select: {
        id: true,
        groupName: true,
        legacyId: true
      }
    });

    if (syncEnabledGroups.length === 0) {
      return {
        source: null,
        totalRecords: 0,
        data: [],
        message: 'Nema grupa označenih za sinhronizaciju. Molimo prvo označite grupe u opciji Grupe Korisnika.'
      };
    }

    // Find mapping for users table
    const mapping = await this.prisma.legacyTableMapping.findFirst({
      where: {
        localTableName: 'users',
        syncEnabled: true,
      },
      include: {
        legacyDatabase: true,
      },
    });

    if (!mapping) {
      const disabledMapping = await this.prisma.legacyTableMapping.findFirst({
        where: {
          localTableName: 'users',
        },
        include: {
          legacyDatabase: true,
        },
      });

      if (disabledMapping) {
        throw new BadRequestException(
          'Mapiranje za users tabelu postoji ali sinhronizacija nije omogućena. ' +
          'Molimo omogućite sinhronizaciju u podešavanjima Legacy tabela.',
        );
      }

      throw new NotFoundException(
        'Mapiranje za users tabelu nije pronađeno. ' +
        'Molimo konfigurite mapiranje u podešavanjima Legacy tabela.',
      );
    }

    let connection: Connection | null = null;

    try {
      // Connect to legacy database
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

      // First, get column information from the table
      const [columns] = await connection.execute(
        `SHOW COLUMNS FROM ${mapping.legacyTableName}`
      );

      const columnNames = (columns as any[]).map(col => col.Field.toLowerCase());
      this.logger.log(`Available columns in legacy table: ${columnNames.join(', ')}`);

      // Extract legacy IDs for filtering
      const legacyGroupIds = syncEnabledGroups
        .map(g => g.legacyId)
        .filter(id => id !== null);

      // Build WHERE clause for group filtering
      // Check which group ID column exists in the table
      const possibleGroupColumns = ['group_id', 'grupa_id', 'id_grupe', 'usergroup_id', 'user_group_id', 'grupaid', 'group'];
      const existingGroupColumn = possibleGroupColumns.find(col =>
        columnNames.includes(col.toLowerCase())
      );

      let whereClause = '';
      if (legacyGroupIds.length > 0 && existingGroupColumn) {
        whereClause = `WHERE ${existingGroupColumn} IN (${legacyGroupIds.join(',')})`;
        this.logger.log(`Filtering by column '${existingGroupColumn}' with IDs: ${legacyGroupIds.join(',')}`);
      } else if (legacyGroupIds.length > 0) {
        this.logger.warn(`No group ID column found in legacy table. Available columns: ${columnNames.join(', ')}`);
        // If no group column found, return empty result with message
        return {
          source: {
            database: mapping.legacyDatabase.database,
            host: mapping.legacyDatabase.host,
            table: mapping.legacyTableName,
          },
          totalRecords: 0,
          data: [],
          message: `Kolona za grupu nije pronađena u legacy tabeli. Dostupne kolone: ${columnNames.join(', ')}`,
          syncGroups: syncEnabledGroups.map(g => ({
            id: g.id,
            name: g.groupName,
            legacyId: g.legacyId
          }))
        };
      }

      // Read data from legacy table with filtering
      const query = `SELECT * FROM ${mapping.legacyTableName} ${whereClause} ORDER BY id`;
      this.logger.log(`Executing legacy query: ${query}`);

      const [rows] = await connection.execute(query);

      // Parse mapping config if exists
      let fieldMapping = {
        email: ['email', 'mail', 'e_mail'],
        firstName: ['first_name', 'ime', 'firstname'],
        lastName: ['last_name', 'prezime', 'lastname'],
        username: ['username', 'korisnicko_ime', 'user_name'],
        groupId: ['group_id', 'grupa_id'],
        groupName: ['group_name', 'grupa'],
        isActive: ['is_active', 'active', 'aktivan'],
      };

      if (mapping.mappingConfig) {
        try {
          const customMapping = JSON.parse(mapping.mappingConfig);
          fieldMapping = { ...fieldMapping, ...customMapping };
        } catch (error) {
          this.logger.warn('Failed to parse mappingConfig, using defaults');
        }
      }

      // Helper function to get field value from row
      const getFieldValue = (row: any, fieldNames: string[]) => {
        for (const fieldName of fieldNames) {
          if (row[fieldName] !== undefined && row[fieldName] !== null) {
            return row[fieldName];
          }
        }
        return null;
      };

      // Format data
      const legacyUsers = (rows as any[]).map(row => {
        const email = getFieldValue(row, fieldMapping.email) || '';
        const firstName = getFieldValue(row, fieldMapping.firstName) || '';
        const lastName = getFieldValue(row, fieldMapping.lastName) || '';

        // If we have a full name field, try to split it
        if (!firstName && !lastName && row.name) {
          const nameParts = row.name.split(' ');
          return {
            id: row.id,
            email: email,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            username: getFieldValue(row, fieldMapping.username),
            groupId: getFieldValue(row, fieldMapping.groupId),
            groupName: getFieldValue(row, fieldMapping.groupName),
            isActive: getFieldValue(row, fieldMapping.isActive) !== 0,
            createdAt: row.created_at || null,
            legacyData: { ...row }
          };
        }

        return {
          id: row.id,
          email: email,
          firstName: firstName,
          lastName: lastName,
          username: getFieldValue(row, fieldMapping.username),
          groupId: getFieldValue(row, fieldMapping.groupId),
          groupName: getFieldValue(row, fieldMapping.groupName),
          isActive: getFieldValue(row, fieldMapping.isActive) !== 0,
          createdAt: row.created_at || null,
          legacyData: { ...row }
        };
      });

      // Add group names from our sync-enabled groups
      const enrichedUsers = legacyUsers.map(user => {
        const matchedGroup = syncEnabledGroups.find(g => g.legacyId === user.groupId);
        return {
          ...user,
          groupName: matchedGroup ? matchedGroup.groupName : user.groupName
        };
      });

      return {
        source: {
          database: mapping.legacyDatabase.database,
          host: mapping.legacyDatabase.host,
          table: mapping.legacyTableName,
        },
        totalRecords: enrichedUsers.length,
        data: enrichedUsers,
        syncGroups: syncEnabledGroups.map(g => ({
          id: g.id,
          name: g.groupName,
          legacyId: g.legacyId
        }))
      };

    } catch (error) {
      this.logger.error('Error fetching legacy users:', error);
      throw new BadRequestException(
        `Greška pri čitanju podataka iz legacy baze: ${error.message}`,
      );
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  async syncLegacyUsers(users: any[]) {
    const results = {
      success: 0,
      skipped: 0,
      errors: 0,
      duplicates: [] as { email: string; firstName: string; lastName: string }[],
    };

    // Get all existing emails and legacy IDs for quick lookup
    const existingUsers = await this.prisma.user.findMany({
      select: {
        email: true,
        legacyId: true,
      },
    });

    const existingEmails = new Set(
      existingUsers.map(u => u.email.toLowerCase())
    );

    const existingLegacyIds = new Set(
      existingUsers.filter(u => u.legacyId).map(u => u.legacyId)
    );

    // Get user groups for mapping
    const userGroups = await this.prisma.userGroup.findMany({
      where: { syncEnabled: true },
    });

    for (const legacyUser of users) {
      try {
        // Check if user already exists by email or legacy ID
        const emailExists = existingEmails.has(legacyUser.email?.toLowerCase());
        const legacyIdExists = existingLegacyIds.has(legacyUser.id);

        if (emailExists || legacyIdExists) {
          results.skipped++;
          if (emailExists) {
            results.duplicates.push({
              email: legacyUser.email,
              firstName: legacyUser.first_name || legacyUser.firstName || '',
              lastName: legacyUser.last_name || legacyUser.lastName || '',
            });
          }
          continue;
        }

        // Find matching user group by legacy ID
        let userGroupId: number | null = null;
        if (legacyUser.group_id || legacyUser.groupId) {
          const groupLegacyId = legacyUser.group_id || legacyUser.groupId;
          const matchingGroup = userGroups.find(g => g.legacyId === groupLegacyId);
          if (matchingGroup) {
            userGroupId = matchingGroup.id;
          }
        }

        // Generate temporary password
        const temporaryPassword = this.generateSecurePassword();
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        // Create user with legacy ID
        const newUser = await this.prisma.user.create({
          data: {
            email: legacyUser.email || `user${legacyUser.id}@legacy.local`,
            firstName: legacyUser.first_name || legacyUser.firstName || 'Legacy',
            lastName: legacyUser.last_name || legacyUser.lastName || 'User',
            password: hashedPassword,
            isActive: legacyUser.active !== false && legacyUser.isActive !== false,
            legacyId: legacyUser.id,
            userGroupId: userGroupId,
          },
        });

        // Assign default role
        const defaultRole = await this.prisma.role.findUnique({
          where: { name: 'USER' },
        });

        if (defaultRole) {
          await this.prisma.userRole.create({
            data: {
              userId: newUser.id,
              roleId: defaultRole.id,
            },
          });
        }

        // Try to send welcome email
        try {
          await this.mailService.sendWelcomeEmail({
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            temporaryPassword,
          });
          this.logger.log(`Welcome email sent to ${newUser.email}`);
        } catch (emailError) {
          this.logger.error(`Failed to send welcome email to ${newUser.email}:`, emailError);
          // Don't fail the sync if email doesn't work
        }

        results.success++;

      } catch (error) {
        this.logger.error(`Error syncing user ${legacyUser.id}:`, error);
        results.errors++;
      }
    }

    return results;
  }
}
