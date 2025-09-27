import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserGroupsService } from './user-groups.service';
import { CreateUserGroupDto } from './dto/create-user-group.dto';
import { UpdateUserGroupDto } from './dto/update-user-group.dto';
import { BulkSyncStatusDto } from './dto/bulk-sync-status.dto';

@ApiTags('User Groups')
@Controller('user-groups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserGroupsController {
  constructor(private readonly userGroupsService: UserGroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all user groups' })
  @RequirePermissions('users.groups:view')
  async findAll(
    @Query('includeInactive') includeInactive?: boolean,
    @Query('driver') driver?: boolean,
    @Query('userClass') userClass?: number,
  ) {
    return this.userGroupsService.findAll({
      includeInactive,
      driver,
      userClass,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user group by id' })
  @RequirePermissions('users.groups:view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userGroupsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new user group' })
  @RequirePermissions('users.groups:create')
  async create(@Body() createUserGroupDto: CreateUserGroupDto) {
    return this.userGroupsService.create(createUserGroupDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user group' })
  @RequirePermissions('users.groups:edit')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserGroupDto: UpdateUserGroupDto,
  ) {
    return this.userGroupsService.update(id, updateUserGroupDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user group' })
  @RequirePermissions('users.groups:delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.userGroupsService.remove(id);
  }

  @Get(':id/users')
  @ApiOperation({ summary: 'Get all users in a group' })
  @RequirePermissions('users.groups:view')
  async getUsersInGroup(@Param('id', ParseIntPipe) id: number) {
    return this.userGroupsService.getUsersInGroup(id);
  }

  @Post(':id/users/:userId')
  @ApiOperation({ summary: 'Add user to group' })
  @RequirePermissions('users.groups:edit')
  async addUserToGroup(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.userGroupsService.addUserToGroup(groupId, userId);
  }

  @Delete(':id/users/:userId')
  @ApiOperation({ summary: 'Remove user from group' })
  @RequirePermissions('users.groups:edit')
  async removeUserFromGroup(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.userGroupsService.removeUserFromGroup(groupId, userId);
  }

  @Post('bulk-sync-status')
  @ApiOperation({ summary: 'Update sync status for multiple groups' })
  @RequirePermissions('users.groups:edit')
  async updateSyncStatus(
    @Req() req: Request,
  ) {
    const body = req.body;

    // Extract updates from body
    let updates: any[] = [];

    // Handle raw array
    if (Array.isArray(body)) {
      updates = body;
    } else {
      throw new BadRequestException('Body must be an array of updates');
    }

    // Validate each item
    for (const item of updates) {
      if (typeof item.id !== 'number' || typeof item.syncEnabled !== 'boolean') {
        throw new BadRequestException('Each item must have id (number) and syncEnabled (boolean)');
      }
    }

    return this.userGroupsService.updateSyncStatus(updates);
  }

  @Get('legacy/fetch')
  @ApiOperation({ summary: 'Fetch user groups from legacy database' })
  @RequirePermissions('users.groups:view')
  async fetchLegacyUserGroups() {
    return this.userGroupsService.fetchLegacyUserGroups();
  }
}