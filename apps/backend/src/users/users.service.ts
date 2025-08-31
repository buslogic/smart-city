import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
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

      return new UserResponseDto(updatedUser);
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
    const updateData = { ...userData };
    
    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
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
}
