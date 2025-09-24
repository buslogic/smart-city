import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateCompanyInfoDto, UpdateCompanyInfoDto } from './dto/company-info.dto';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('company-info')
  @RequirePermissions('settings.company_info:read')
  @ApiOperation({ summary: 'Get company information' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Company info retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Company info not found' })
  async getCompanyInfo() {
    return this.settingsService.getCompanyInfo();
  }

  @Post('company-info')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('settings.company_info:write')
  @ApiOperation({ summary: 'Create or update company information' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Company info saved successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid data' })
  async createOrUpdateCompanyInfo(@Body() dto: CreateCompanyInfoDto) {
    return this.settingsService.createOrUpdateCompanyInfo(dto);
  }
}