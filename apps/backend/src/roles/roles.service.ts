import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(createRoleDto: { name: string; description?: string }) {
    const existingRole = await this.prisma.role.findUnique({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new ConflictException('Role with this name already exists');
    }

    return this.prisma.role.create({
      data: createRoleDto,
    });
  }

  async findAll(page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              permissions: true,
            },
          },
        },
      }),
      this.prisma.role.count(),
    ]);

    return {
      data: roles,
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // Konvertuj BigInt u Number za JSON serijalizaciju
    const processedRole = {
      ...role,
      permissions: role.permissions.map((rp) => ({
        ...rp,
        permission: {
          ...rp.permission,
          menuOrder: rp.permission.menuOrder ? Number(rp.permission.menuOrder) : null,
        },
      })),
    };

    return processedRole;
  }

  async update(
    id: number,
    updateRoleDto: { name?: string; description?: string },
  ) {
    const existingRole = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    if (updateRoleDto.name && updateRoleDto.name !== existingRole.name) {
      const nameExists = await this.prisma.role.findUnique({
        where: { name: updateRoleDto.name },
      });

      if (nameExists) {
        throw new ConflictException('Role with this name already exists');
      }
    }

    return this.prisma.role.update({
      where: { id },
      data: updateRoleDto,
    });
  }

  async remove(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    if (role._count.users > 0) {
      throw new ConflictException('Cannot delete role that has users assigned');
    }

    await this.prisma.role.delete({
      where: { id },
    });
  }

  async getRolePermissions(roleId: number) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Konvertuj BigInt u Number za JSON serijalizaciju
    const processedPermissions = role.permissions.map((rp) => ({
      ...rp.permission,
      menuOrder: rp.permission.menuOrder ? Number(rp.permission.menuOrder) : null,
    }));

    return processedPermissions;
  }

  async updateRolePermissions(roleId: number, permissionIds: number[]) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Delete all existing permissions for this role
    await this.prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Add new permissions
    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      });
    }

    return this.getRolePermissions(roleId);
  }

  async addPermissionToRole(roleId: number, permissionId: number) {
    const [role, permission] = await Promise.all([
      this.prisma.role.findUnique({ where: { id: roleId } }),
      this.prisma.permission.findUnique({ where: { id: permissionId } }),
    ]);

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    if (!permission) {
      throw new NotFoundException(
        `Permission with ID ${permissionId} not found`,
      );
    }

    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Permission already assigned to this role');
    }

    const result = await this.prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
      },
      include: {
        permission: true,
      },
    });

    // Konvertuj BigInt u Number za JSON serijalizaciju
    return {
      ...result,
      permission: {
        ...result.permission,
        menuOrder: result.permission.menuOrder ? Number(result.permission.menuOrder) : null,
      },
    };
  }

  async removePermissionFromRole(roleId: number, permissionId: number) {
    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Permission not assigned to this role');
    }

    await this.prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });
  }
}
