import { ApiProperty } from '@nestjs/swagger';

export class RoutePermissionDto {
  @ApiProperty({ description: 'UI ruta' })
  route: string;

  @ApiProperty({ description: 'Potrebne permisije za rutu' })
  requiredPermissions: string[];

  @ApiProperty({ description: 'Opcione permisije za dodatne funkcionalnosti' })
  optionalPermissions?: string[];
}

export class PermissionDetailDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  resource: string;

  @ApiProperty()
  action: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  descriptionSr?: string;

  @ApiProperty({ required: false })
  category?: string;

  @ApiProperty({ required: false })
  uiRoute?: string;

  @ApiProperty({ required: false })
  requiredFor?: string[];
}

export class UserPermissionStatusDto {
  @ApiProperty()
  permission: string;

  @ApiProperty()
  hasAccess: boolean;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  descriptionSr?: string;
}

export class PermissionDebugInfoDto {
  @ApiProperty({ description: 'Trenutni korisnik' })
  user: {
    id: number;
    email: string;
    roles: string[];
  };

  @ApiProperty({ description: 'Sve permisije korisnika' })
  userPermissions: string[];

  @ApiProperty({ description: 'Permisije grupisane po kategorijama' })
  permissionsByCategory: Record<string, PermissionDetailDto[]>;

  @ApiProperty({ description: 'Mapiranje ruta na permisije' })
  routePermissions: RoutePermissionDto[];

  @ApiProperty({ description: 'Permisije za trenutnu rutu', required: false })
  currentRoutePermissions?: {
    route: string;
    required: UserPermissionStatusDto[];
    optional: UserPermissionStatusDto[];
  };

  @ApiProperty({ description: 'Statistike' })
  stats: {
    totalPermissions: number;
    userPermissionsCount: number;
    coverage: number; // procenat permisija koje korisnik ima
  };
}