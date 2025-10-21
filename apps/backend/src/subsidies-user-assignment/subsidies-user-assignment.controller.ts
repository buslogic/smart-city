import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { SubsidiesUserAssignmentService } from './subsidies-user-assignment.service';
import { AssignSubsidyDto } from './dto/assign-subsidy.dto';
import { ReassignSubsidyDto } from './dto/reassign-subsidy.dto';
import { RemoveSubsidyDto } from './dto/remove-subsidy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('subsidies-user-assignment')
@UseGuards(JwtAuthGuard)
export class SubsidiesUserAssignmentController {
  constructor(
    private readonly service: SubsidiesUserAssignmentService,
  ) {}

  @Post('assigned/:userId')
  async getAssignedSubventions(@Param('userId', ParseIntPipe) userId: number) {
    return this.service.getAssignedSubventions(userId);
  }

  @Post('assign')
  async assignSubvention(@Body() dto: AssignSubsidyDto, @Request() req) {
    const userId = req.user.id;
    return this.service.assignSubvention(dto, userId);
  }

  @Post('reassign')
  async reassignSubvention(@Body() dto: ReassignSubsidyDto, @Request() req) {
    const userId = req.user.id;
    return this.service.reassignSubvention(dto, userId);
  }

  @Post('remove')
  async removeSubvention(@Body() dto: RemoveSubsidyDto) {
    return this.service.removeSubvention(dto);
  }
}
