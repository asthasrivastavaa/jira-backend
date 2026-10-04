import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Scope } from '../../common/decorators/scope.decorator.js';
import { ProjectMemberGuard } from '../../common/gaurds/project-member.gaurd.js';
import { WorkspaceRoleGuard } from '../../common/gaurds/workspace-role.gaurd.js';

// Role matrix: everyone in the workspace can read projects; only admins and owners change them.
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('workspaces/:workspaceId/projects')
  @UseGuards(WorkspaceRoleGuard)
  @Roles('admin')
  create(
    @Param('workspaceId', ParseObjectIdPipe) workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(workspaceId, user.id, dto);
  }

  @Get('workspaces/:workspaceId/projects')
  @UseGuards(WorkspaceRoleGuard)
  findAll(@Param('workspaceId', ParseObjectIdPipe) workspaceId: string, @CurrentUser() user: RequestUser) {
    return this.projectsService.findAll(workspaceId, user.id);
  }

  @Get('workspaces/:workspaceId/projects/key/:key')
  @UseGuards(WorkspaceRoleGuard)
  findByKey(
    @Param('workspaceId', ParseObjectIdPipe) workspaceId: string,
    @Param('key') key: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.projectsService.findByKey(workspaceId, key, user.id);
  }

  @Get('projects/:id')
  @UseGuards(ProjectMemberGuard)
  @Scope('project', 'id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch('projects/:id')
  @UseGuards(ProjectMemberGuard)
  @Scope('project', 'id')
  @Roles('admin')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete('projects/:id')
  @UseGuards(ProjectMemberGuard)
  @Scope('project', 'id')
  @Roles('admin')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.projectsService.remove(id);
    return { id };
  }
}
