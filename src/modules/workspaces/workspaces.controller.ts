import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { CreateInvitesDto } from './dto/create-invites.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto.js';
import { InvitesService } from './invites.service.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly invites: InvitesService,
  ) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto);
  }

  @Get()
  mine(@CurrentUser() user: RequestUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Get('slug-available')
  async slugAvailable(@Query('slug') slug = '') {
    return { available: await this.workspaces.isSlugAvailable(slug.trim().toLowerCase()) };
  }

  @Get('slug/:slug')
  bySlug(@Param('slug') slug: string, @CurrentUser() user: RequestUser) {
    return this.workspaces.findBySlugForUser(slug, user.id);
  }

  @Post(':id/onboarding/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.workspaces.completeOnboarding(id, user.id);
  }

  // ---- settings (2.8) ----

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workspaces.update(id, user.id, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':id/transfer')
  @HttpCode(HttpStatus.OK)
  transfer(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workspaces.transferOwnership(id, user.id, dto.userId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.workspaces.remove(id, user.id);
  }

  // ---- members ----

  @Get(':id/members')
  members(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.workspaces.listMembers(id, user.id);
  }

  @Patch(':id/members/:userId')
  changeRole(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('userId', ParseObjectIdPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workspaces.changeRole(id, userId, dto.role, user.id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('userId', ParseObjectIdPipe) userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workspaces.removeMember(id, userId, user.id);
  }

  // ---- invites ----

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/invites')
  createInvites(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateInvitesDto,
  ) {
    return this.invites.create(id, user.id, dto.emails, dto.role);
  }

  @Get(':id/invites')
  listInvites(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.invites.list(id, user.id);
  }

  @Delete(':id/invites/:inviteId')
  revokeInvite(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('inviteId', ParseObjectIdPipe) inviteId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invites.revoke(id, inviteId, user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/invites/:inviteId/resend')
  @HttpCode(HttpStatus.OK)
  resendInvite(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('inviteId', ParseObjectIdPipe) inviteId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.invites.resend(id, inviteId, user.id);
  }
}
