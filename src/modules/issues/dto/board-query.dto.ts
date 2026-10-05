import { IsOptional, Matches } from 'class-validator';
import { ASSIGNEE_FILTER } from './list-issues-query.dto.js';

export class BoardQueryDto {
  @IsOptional()
  @Matches(ASSIGNEE_FILTER, { message: 'assignee must be "me", "none" or a user id' })
  assignee?: string;
}
