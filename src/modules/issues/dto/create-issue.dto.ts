import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ISSUE_TYPES } from '../schemas/issue.schema.js';
import type { IssuePriority, IssueStatus, IssueType } from '../schemas/issue.schema.js';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(ISSUE_TYPES)
  type?: IssueType;

  @IsOptional()
  @IsIn(ISSUE_STATUSES)
  status?: IssueStatus;

  @IsOptional()
  @IsIn(ISSUE_PRIORITIES)
  priority?: IssuePriority;

  // null = unassigned. Membership in the workspace is checked in the service.
  @IsOptional()
  @IsMongoId()
  assigneeId?: string | null;

  // must belong to this project (checked in the service)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsMongoId({ each: true })
  labelIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  storyPoints?: number | null;

  // a calendar day, no time and no timezone
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueDate must be a date like 2026-10-10' })
  dueDate?: string | null;

  // null = backlog. Must be an open sprint of this project (checked in the service).
  @IsOptional()
  @IsMongoId()
  sprintId?: string | null;

  // required for a subtask, optional epic for task/story/bug, forbidden for an epic (checked in the service)
  @IsOptional()
  @IsMongoId()
  parentId?: string | null;

  // reporterId is deliberately NOT here: the server sets it from the logged-in user
}
