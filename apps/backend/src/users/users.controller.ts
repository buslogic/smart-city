import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
  UseInterceptors,
  ClassSerializerInterceptor,
  Req,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('users')
@Controller('users')
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('users:create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully created',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @RequirePermissions('users.administration:view')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: [UserResponseDto],
  })
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const size = pageSize ? parseInt(pageSize, 10) : 10;
    return this.usersService.findAll(pageNum, size, search);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findOneWithDetails(req.user.id);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar || null,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles?.map((ur) => ur.role.name) || [],
    };
  }

  @Get('emails')
  @RequirePermissions('users.administration:view')
  @ApiOperation({ summary: 'Get all user emails' })
  @ApiResponse({
    status: 200,
    description: 'Emails retrieved successfully',
  })
  async getAllEmails() {
    const emails = await this.usersService.getAllEmails();
    return { emails };
  }

  @Get('existing-sync')
  @RequirePermissions('users.administration:view')
  @ApiOperation({ summary: 'Get existing users for sync comparison' })
  @ApiResponse({
    status: 200,
    description: 'Existing users data retrieved successfully',
  })
  async getExistingUsersForSync() {
    return await this.usersService.getExistingUsersForSync();
  }

  @Get('legacy')
  @RequirePermissions('users.administration:view')
  @ApiOperation({ summary: 'Get users from legacy database' })
  @ApiResponse({
    status: 200,
    description: 'Legacy users retrieved successfully',
  })
  fetchLegacyUsers() {
    return this.usersService.fetchLegacyUsers();
  }

  @Get(':id')
  @RequirePermissions('users.administration:view')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.usersService.remove(id);
  }

  @Patch(':id/status')
  @RequirePermissions('users:update')
  @ApiOperation({ summary: 'Toggle user status' })
  @ApiResponse({
    status: 200,
    description: 'User status updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
  ): Promise<UserResponseDto> {
    return this.usersService.toggleStatus(id, isActive);
  }

  @Patch('profile/avatar')
  @ApiOperation({ summary: 'Update profile avatar' })
  @ApiResponse({ status: 200, description: 'Avatar updated successfully' })
  async updateAvatar(
    @Request() req: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    await this.usersService.updateProfile(req.user.id, {
      avatar: updateProfileDto.avatarUrl,
    });
    return this.getProfile(req);
  }

  @Delete('profile/avatar')
  @ApiOperation({ summary: 'Remove profile avatar' })
  @ApiResponse({ status: 200, description: 'Avatar removed successfully' })
  async removeAvatar(@Request() req: any) {
    await this.usersService.updateProfile(req.user.id, {
      avatar: null,
    });
    return this.getProfile(req);
  }

  @Post('sync-legacy')
  @RequirePermissions('users:create')
  @ApiOperation({ summary: 'Sync users from legacy database' })
  @ApiResponse({
    status: 200,
    description: 'Users synchronized successfully',
  })
  syncLegacyUsers(@Body() body: { users: any[] }) {
    return this.usersService.syncLegacyUsers(body.users);
  }
}
