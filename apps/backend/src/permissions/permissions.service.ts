import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionDebugInfoDto, PermissionDetailDto, RoutePermissionDto, UserPermissionStatusDto } from './dto/permission-debug.dto';
import { routePermissionsConfig } from './config/route-permissions.config';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' },
      ],
    });

    return {
      data: permissions,
      total: permissions.length,
    };
  }

  async getDebugInfo(userId: number, currentRoute?: string): Promise<PermissionDebugInfoDto> {
    // Fetch user with roles and permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get all permissions from database
    const allPermissions = await this.prisma.permission.findMany({
      orderBy: [
        { category: 'asc' },
        { resource: 'asc' },
        { action: 'asc' },
      ],
    });

    // Extract user permissions
    const userPermissions = new Set<string>();
    const userRoles = new Set<string>();
    
    user.roles.forEach(userRole => {
      userRoles.add(userRole.role.name);
      userRole.role.permissions.forEach(rolePerm => {
        userPermissions.add(rolePerm.permission.name);
      });
    });

    // Group permissions by category
    const permissionsByCategory: Record<string, PermissionDetailDto[]> = {};
    allPermissions.forEach(perm => {
      const category = perm.category || 'Ostalo';
      if (!permissionsByCategory[category]) {
        permissionsByCategory[category] = [];
      }
      
      permissionsByCategory[category].push({
        id: perm.id,
        name: perm.name,
        resource: perm.resource,
        action: perm.action,
        description: perm.description || undefined,
        descriptionSr: perm.descriptionSr || undefined,
        category: perm.category || undefined,
        uiRoute: perm.uiRoute || undefined,
        requiredFor: perm.requiredFor ? JSON.parse(perm.requiredFor) : undefined,
      });
    });

    // Get route permissions mapping
    const routePermissions: RoutePermissionDto[] = routePermissionsConfig;

    // Get current route permissions if provided
    let currentRoutePermissions;
    if (currentRoute) {
      const routeConfig = routePermissions.find(r => r.route === currentRoute);
      if (routeConfig) {
        const required: UserPermissionStatusDto[] = (routeConfig.requiredPermissions || []).map(permName => {
          const perm = allPermissions.find(p => p.name === permName);
          return {
            permission: permName,
            hasAccess: userPermissions.has(permName),
            description: perm?.description || undefined,
            descriptionSr: perm?.descriptionSr || undefined,
          };
        });

        const optional: UserPermissionStatusDto[] = (routeConfig.optionalPermissions || []).map(permName => {
          const perm = allPermissions.find(p => p.name === permName);
          return {
            permission: permName,
            hasAccess: userPermissions.has(permName),
            description: perm?.description || undefined,
            descriptionSr: perm?.descriptionSr || undefined,
          };
        });

        currentRoutePermissions = {
          route: currentRoute,
          required,
          optional,
        };
      }
    }

    // Calculate stats
    const stats = {
      totalPermissions: allPermissions.length,
      userPermissionsCount: userPermissions.size,
      coverage: allPermissions.length > 0 
        ? Math.round((userPermissions.size / allPermissions.length) * 100) 
        : 0,
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        roles: Array.from(userRoles),
      },
      userPermissions: Array.from(userPermissions),
      permissionsByCategory,
      routePermissions,
      currentRoutePermissions,
      stats,
    };
  }
}