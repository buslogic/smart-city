import { Controller, Get, UseGuards, Query, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionDebugInfoDto } from './dto/permission-debug.dto';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(JwtAuthGuard) // Samo proveri da li je korisnik ulogovan
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
  })
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get('debug-info')
  @ApiOperation({
    summary: 'Get permission debug information for current user',
  })
  @ApiQuery({
    name: 'route',
    required: false,
    description: 'Current UI route for context',
  })
  @ApiResponse({
    status: 200,
    description: 'Debug information retrieved successfully',
    type: PermissionDebugInfoDto,
  })
  async getDebugInfo(
    @Request() req,
    @Query('route') currentRoute?: string,
  ): Promise<PermissionDebugInfoDto> {
    return this.permissionsService.getDebugInfo(req.user.id, currentRoute);
  }
}
