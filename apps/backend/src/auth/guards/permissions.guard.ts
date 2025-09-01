import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      console.error('PermissionsGuard: Korisnik nije autentifikovan');
      throw new ForbiddenException('Korisnik nije autentifikovan');
    }

    // Debug logovi - zakomentarisani da ne zagušuju konzolu
    // console.log('PermissionsGuard - Required:', requiredPermissions);
    // console.log('PermissionsGuard - User permissions:', user.permissions);

    const hasPermission = requiredPermissions.some((permission) =>
      user.permissions?.includes(permission),
    );

    if (!hasPermission) {
      console.error(`PermissionsGuard: Korisnik ${user.email} nema permisiju. Potrebno: ${requiredPermissions.join(', ')}, Ima: ${user.permissions?.join(', ') || 'none'}`);
      throw new ForbiddenException(
        `Nemate dozvolu za pristup ovom resursu. Potrebne permisije: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}