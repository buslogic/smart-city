import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform, Type } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty()
  @Expose()
  firstName: string;

  @ApiProperty()
  @Expose()
  lastName: string;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  lastLoginAt: Date | null;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty({ type: [String] })
  @Expose()
  roles: string[];

  @Exclude()
  password: string;

  @Exclude()
  refreshToken: string | null;

  constructor(partial: any) {
    if (!partial) return;

    Object.assign(this, partial);

    // Transform roles if they come from Prisma with nested structure
    if (partial.roles && Array.isArray(partial.roles)) {
      if (partial.roles.length > 0) {
        if (
          typeof partial.roles[0] === 'object' &&
          'role' in partial.roles[0]
        ) {
          this.roles = partial.roles
            .map((userRole: any) => userRole.role?.name)
            .filter(Boolean);
        } else if (typeof partial.roles[0] === 'string') {
          this.roles = partial.roles;
        } else {
          this.roles = [];
        }
      } else {
        this.roles = [];
      }
    } else {
      this.roles = [];
    }
  }
}
