import { IsIn, IsMongoId, IsOptional } from 'class-validator';
import { ISSUE_STATUSES } from '../schemas/issue.schema.js';
import type { IssueStatus } from '../schemas/issue.schema.js';

export class MoveIssueDto {
  @IsIn(ISSUE_STATUSES)
  status: IssueStatus;

  /** the card that ends up directly ABOVE the moved one (omit when dropped at the top) */
  @IsOptional()
  @IsMongoId()
  beforeId?: string;

  /** the card that ends up directly BELOW the moved one (omit when dropped at the bottom) */
  @IsOptional()
  @IsMongoId()
  afterId?: string;
}
