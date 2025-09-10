import { ApiProperty } from '@nestjs/swagger';

export class UserInfo {
  @ApiProperty()
  id: number;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ isArray: true, example: ['SUPER_ADMIN'] })
  roles: string[];

  @ApiProperty({ isArray: true, example: ['users:create', 'users:view'] })
  permissions: string[];
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: UserInfo;

  @ApiProperty()
  expiresIn: number;
}