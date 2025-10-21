import { Body, Controller, Delete, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserAccountsService } from './user-accounts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  SearchUserAccountsDto,
  SearchUserAccountByIdDto,
  SearchUserAccountsByTypeDto,
} from './dto/search-user-accounts.dto';
import { CreateUserAccountDto } from './dto/create-user-account.dto';
import {
  GetServicesByUserAccountIdDto,
  AssignPricelistDto,
  EditUserAccountServiceDto,
  RemoveAccountServiceDto,
} from './dto/user-account-service.dto';

@ApiTags('User Accounts')
@Controller('user-accounts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class UserAccountsController {
  constructor(private readonly userAccountsService: UserAccountsService) {}

  @Post('services/by-user-account-id')
  @ApiOperation({ summary: 'Get services by user account ID' })
  @RequirePermissions('vodovod:user-accounts:read')
  async getServicesByUserAccountID(@Body() dto: GetServicesByUserAccountIdDto) {
    return this.userAccountsService.getServicesByUserAccountID(dto);
  }

  @Post('services/edit')
  @ApiOperation({ summary: 'Edit user account service' })
  @RequirePermissions('vodovod:user-accounts:update')
  async editUserAccountService(@Body() dto: EditUserAccountServiceDto) {
    const data = await this.userAccountsService.editUserAccountService(dto);
    return {
      success: !!data,
      data,
    };
  }

  @Post('services/assign-pricelist')
  @ApiOperation({ summary: 'Assign pricelist to user account' })
  @RequirePermissions('vodovod:user-accounts:update')
  async assignPricelistToUserAccount(@Body() dto: AssignPricelistDto) {
    const data = await this.userAccountsService.assignPricelistToUserAccount(dto);
    return {
      success: !!data,
      data,
    };
  }

  @Delete('services/remove')
  @ApiOperation({ summary: 'Remove account service' })
  @RequirePermissions('vodovod:user-accounts:delete')
  async removeAccountService(@Body() dto: RemoveAccountServiceDto) {
    const result = await this.userAccountsService.removeAccountService(dto);
    return {
      success: result.success,
      data: result,
    };
  }

  @Post('search/by-type')
  @ApiOperation({ summary: 'Get rows by type (idmm or consumer)' })
  @RequirePermissions('vodovod:user-accounts:read')
  async getRows(@Body() dto: SearchUserAccountsByTypeDto) {
    return this.userAccountsService.getRows(dto);
  }

  @Post('by-id')
  @ApiOperation({ summary: 'Get user account by ID with full details' })
  @RequirePermissions('vodovod:user-accounts:read')
  async getUserAccountByID(@Body() dto: SearchUserAccountByIdDto) {
    return this.userAccountsService.getUserAccountByID(dto);
  }

  @Post('search/for-sl')
  @ApiOperation({ summary: 'Get user accounts for SearchList component' })
  @RequirePermissions('vodovod:user-accounts:read')
  async getUserAccountsForSL(@Body() dto: SearchUserAccountsDto) {
    return this.userAccountsService.getUserAccountsForSL(dto);
  }

  @Post('search/crm-contacts-for-sl')
  @ApiOperation({ summary: 'Get CRM contacts for SearchList' })
  @RequirePermissions('vodovod:user-accounts:read')
  async getCrmContactsForSL(@Body() dto: SearchUserAccountsDto) {
    return this.userAccountsService.getCrmContactsForSL(dto);
  }

  @Post('search/unused-crm-accounts-for-sl')
  @ApiOperation({ summary: 'Get unused CRM accounts for SearchList' })
  @RequirePermissions('vodovod:user-accounts:read')
  async getUnusedCrmAccountsForSL(@Body() dto: SearchUserAccountsDto) {
    return this.userAccountsService.getUnusedCrmAccountsForSL(dto);
  }

  @Post('search/unused-crm-contacts-for-sl')
  @ApiOperation({ summary: 'Get unused CRM contacts for SearchList' })
  @RequirePermissions('vodovod:user-accounts:read')
  async getUnusedCrmContactsForSL(@Body() dto: SearchUserAccountsDto) {
    return this.userAccountsService.getUnusedCrmContactsForSL(dto);
  }

  @Post('search/unused-cashier-crm-contacts-for-sl')
  @ApiOperation({ summary: 'Get unused cashier CRM contacts for SearchList' })
  @RequirePermissions('vodovod:user-accounts:read')
  async getUnusedCashierCrmContactsForSL(@Body() dto: SearchUserAccountsDto) {
    return this.userAccountsService.getUnusedCashierCrmContactsForSL(dto);
  }

  @Post('create')
  @ApiOperation({ summary: 'Create new user account' })
  @RequirePermissions('vodovod:user-accounts:create')
  async addRow(@Body() dto: CreateUserAccountDto) {
    return this.userAccountsService.addRow(dto);
  }

  @Post('getLoggedUser')
  @ApiOperation({ summary: 'Get logged user information' })
  async getLoggedUser(@Request() req) {
    return this.userAccountsService.getLoggedUser(req.user.id);
  }
}
