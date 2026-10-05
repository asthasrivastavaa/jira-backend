import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Scope } from '../../common/decorators/scope.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentMembership } from '../../common/decorators/current-membership.decorator.js';
import { ProjectMemberGuard } from '../../common/gaurds/project-member.gaurd.js';
import type { WorkspaceMemberDocument } from '../workspaces/schemas/workspace-member.schema.js';
import { CommentsService } from './comments.service.js';
import { CommentBodyDto } from './dto/comment-body.dto.js';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto.js';

// Nested under the issue, so the existing guard finds the workspace from :issueId.
// Viewers read; members+ comment; editing is author-only and deleting is author-or-admin (checked in the service,
// because "is this YOUR comment" needs the comment document, which a role guard doesn't have).
@Controller('issues/:issueId/comments')
@UseGuards(ProjectMemberGuard)
@Scope('issue', 'issueId')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@Param('issueId', ParseObjectIdPipe) issueId: string, @Query() query: CursorQueryDto) {
    return this.comments.list(issueId, query);
  }

  @Post()
  @Roles('member')
  create(
    @Param('issueId', ParseObjectIdPipe) issueId: string,
    @Body() dto: CommentBodyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.comments.create(issueId, user.id, dto.body);
  }

  @Patch(':commentId')
  @Roles('member')
  update(
    @Param('issueId', ParseObjectIdPipe) issueId: string,
    @Param('commentId', ParseObjectIdPipe) commentId: string,
    @Body() dto: CommentBodyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.comments.update(issueId, commentId, user.id, dto.body);
  }

  @Delete(':commentId')
  @Roles('member')
  remove(
    @Param('issueId', ParseObjectIdPipe) issueId: string,
    @Param('commentId', ParseObjectIdPipe) commentId: string,
    @CurrentMembership() membership: WorkspaceMemberDocument,
  ) {
    return this.comments.remove(issueId, commentId, membership);
  }
}
