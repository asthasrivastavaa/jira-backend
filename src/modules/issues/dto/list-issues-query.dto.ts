import { IsIn, IsMongoId, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ISSUE_TYPES } from '../schemas/issue.schema.js';
import type { IssuePriority, IssueStatus, IssueType } from '../schemas/issue.schema.js';

export const ISSUE_SORTS = ['-number', 'number', 'title', '-title', '-createdAt', 'createdAt'] as const;
export type IssueSort = (typeof ISSUE_SORTS)[number];
export const ASSIGNEE_FILTER = /^(me|none|[a-f\d]{24})$/i;

export class ListIssuesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ISSUE_STATUSES)
  status?: IssueStatus;

    @IsOptional()
  @Matches(ASSIGNEE_FILTER, { message: 'assignee must be "me", "none" or a user id' })
  assignee?: string;

  @IsOptional()
  @IsMongoId()
  label?: string;


  @IsOptional()
  @IsIn(ISSUE_TYPES)
  type?: IssueType;

  @IsOptional()
  @IsIn(ISSUE_PRIORITIES)
  priority?: IssuePriority;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(ISSUE_SORTS)
  sort?: IssueSort = '-number';
}
