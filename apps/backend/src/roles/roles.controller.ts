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
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesService } from './roles.service';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role successfully created' })
  @ApiResponse({
    status: 409,
    description: 'Role with this name already exists',
  })
  create(@Body() createRoleDto: { name: string; description?: string }) {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const size = pageSize ? parseInt(pageSize, 10) : 10;
    return this.rolesService.findAll(pageNum, size);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiResponse({ status: 200, description: 'Role found' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: { name?: string; description?: string },
  ) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete role' })
  @ApiResponse({ status: 204, description: 'Role deleted successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Get role permissions' })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  getRolePermissions(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.getRolePermissions(id);
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'Update role permissions' })
  @ApiResponse({ status: 200, description: 'Permissions updated successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  updateRolePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body('permissionIds') permissionIds: number[],
  ) {
    return this.rolesService.updateRolePermissions(id, permissionIds);
  }

  @Post(':roleId/permissions/:permissionId')
  @ApiOperation({ summary: 'Add permission to role' })
  @ApiResponse({ status: 201, description: 'Permission added successfully' })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  addPermissionToRole(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
  ) {
    return this.rolesService.addPermissionToRole(roleId, permissionId);
  }

  @Delete(':roleId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove permission from role' })
  @ApiResponse({ status: 204, description: 'Permission removed successfully' })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  removePermissionFromRole(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
  ) {
    return this.rolesService.removePermissionFromRole(roleId, permissionId);
  }
}
