import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
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
        this.logger.error(`Failed to send welcome email to ${updatedUser!.email}:`, error);
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
      this.logger.error(`Failed to send welcome email to ${user.email}:`, error);
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
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map(user => new UserResponseDto(user)),
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
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return new UserResponseDto(user);
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
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
      },
    });

    return new UserResponseDto(updatedUser);
  }

  async updateProfile(id: number, data: { avatar?: string | null }) {
    // Ako je development i briše se avatar, obriši i lokalnu sliku
    if (process.env.NODE_ENV === 'development' && data.avatar === null) {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { avatar: true }
      });
      
      if (user?.avatar && user.avatar.includes('/uploads/avatars/')) {
        const filename = user.avatar.split('/').pop();
        if (filename) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(process.cwd(), 'uploads', 'avatars', filename);
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
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  private generateSecurePassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+-=';
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
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
