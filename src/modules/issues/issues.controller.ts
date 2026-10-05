import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IssuesService } from './issues.service.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { ListIssuesQueryDto } from './dto/list-issues-query.dto.js';
import { MoveIssueDto } from './dto/move-issue.dto.js';
import { BoardQueryDto } from './dto/board-query.dto.js';
import { RankIssueDto } from './dto/rank-issue.dto.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Scope } from '../../common/decorators/scope.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { ProjectMemberGuard } from '../../common/gaurds/project-member.gaurd.js';

// Role matrix: viewers read; members, admins and owners create / edit / delete issues.
// ProjectMemberGuard finds the workspace from the project/issue id, so guessing an id gets a 404.
@Controller()
@UseGuards(ProjectMemberGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  // ---- project-scoped (default scope = project from :projectId) ----

  @Post('projects/:projectId/issues')
  @Roles('member')
  create(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.issuesService.create(projectId, dto, user.id);
  }

  @Get('projects/:projectId/issues')
  findAll(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Query() query: ListIssuesQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.issuesService.findAllByProject(projectId, query, user.id);
  }

  @Get('projects/:projectId/issues/key/:key')
  findByKey(@Param('projectId', ParseObjectIdPipe) projectId: string, @Param('key') key: string) {
    return this.issuesService.findByKey(projectId, key);
  }

  @Get('projects/:projectId/board')
  board(
    @Param('projectId', ParseObjectIdPipe) projectId: string,
    @Query() query: BoardQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.issuesService.getBoard(projectId, user.id, query.assignee);
  }

  @Get('projects/:projectId/epics')
  epics(@Param('projectId', ParseObjectIdPipe) projectId: string) {
    return this.issuesService.epics(projectId);
  }

  // ---- issue-scoped ----

  @Get('issues/:id/children')
  @Scope('issue', 'id')
  children(@Param('id', ParseObjectIdPipe) id: string) {
    return this.issuesService.children(id);
  }

  @Get('issues/:id')
  @Scope('issue', 'id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.issuesService.findOne(id);
  }

  @Patch('issues/:id')
  @Scope('issue', 'id')
  @Roles('member')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.issuesService.update(id, dto, user.id);
  }

  @Patch('issues/:id/move')
  @Scope('issue', 'id')
  @Roles('member')
  move(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: MoveIssueDto, @CurrentUser() user: RequestUser) {
    return this.issuesService.move(id, dto, user.id);
  }

  @Patch('issues/:id/rank')
  @Scope('issue', 'id')
  @Roles('member')
  rank(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: RankIssueDto, @CurrentUser() user: RequestUser) {
    return this.issuesService.rank(id, dto, user.id);
  }

  @Delete('issues/:id')
  @Scope('issue', 'id')
  @Roles('member')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.issuesService.remove(id);
    return { id };
  }
}
