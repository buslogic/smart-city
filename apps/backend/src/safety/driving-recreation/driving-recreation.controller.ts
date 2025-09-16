import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DrivingRecreationService } from './driving-recreation.service';
import {
  StartRecreationDto,
  RecreationStatusDto,
  VehicleWithStatsDto,
  RecreationHistoryDto,
  PreviewDto,
} from './dto/driving-recreation.dto';

@ApiTags('Driving Recreation')
@ApiBearerAuth()
@Controller('driving-recreation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DrivingRecreationController {
  // Deploy trigger: 16.09.2025 - Ensure driving-recreation module is deployed
  constructor(private readonly drivingRecreationService: DrivingRecreationService) {}

  @Get('vehicles')
  @RequirePermissions('safety.data.recreation:view')
  @ApiOperation({ summary: 'Get vehicles with GPS and events statistics' })
  @ApiResponse({ status: 200, type: [VehicleWithStatsDto] })
  async getVehiclesWithStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<VehicleWithStatsDto[]> {
    return this.drivingRecreationService.getVehiclesWithStats(startDate, endDate);
  }

  @Post('start')
  @RequirePermissions('safety.data.recreation:start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start driving events recreation process' })
  @ApiResponse({ status: 201, description: 'Recreation started successfully' })
  async startRecreation(
    @CurrentUser() user: any,
    @Body() dto: StartRecreationDto,
  ): Promise<{ id: number; message: string }> {
    return this.drivingRecreationService.startRecreation(user.id, dto);
  }

  @Get('status/:id')
  @RequirePermissions('safety.data.recreation:view')
  @ApiOperation({ summary: 'Get recreation process status' })
  @ApiResponse({ status: 200, type: RecreationStatusDto })
  async getRecreationStatus(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RecreationStatusDto> {
    return this.drivingRecreationService.getRecreationStatus(id);
  }

  @Delete('stop/:id')
  @RequirePermissions('safety.data.recreation:stop')
  @ApiOperation({ summary: 'Stop recreation process' })
  @ApiResponse({ status: 200, description: 'Recreation stopped successfully' })
  async stopRecreation(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    return this.drivingRecreationService.stopRecreation(id);
  }

  @Get('history')
  @RequirePermissions('safety.data.recreation:view')
  @ApiOperation({ summary: 'Get recreation history' })
  @ApiResponse({ status: 200, type: [RecreationHistoryDto] })
  async getRecreationHistory(
    @Query('userId') userId?: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<{ data: RecreationHistoryDto[]; total: number }> {
    return this.drivingRecreationService.getRecreationHistory(userId, page, limit);
  }

  @Post('preview')
  @RequirePermissions('safety.data.recreation:configure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview events count for selected vehicles' })
  @ApiResponse({ status: 200 })
  async previewEventsCount(
    @Body() dto: PreviewDto,
  ): Promise<{ vehicleId: number; garageNo: string; existingEvents: number; estimatedNew: number }[]> {
    return this.drivingRecreationService.previewEventsCount(
      dto.vehicleIds,
      dto.startDate,
      dto.endDate,
    );
  }
}