
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ISSUE_TYPES } from '../schemas/issue.schema.js';
import type { IssuePriority, IssueStatus, IssueType } from '../schemas/issue.schema.js';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';


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
  @Transform(({ value }) =>
    Array.isArray(value)
      ? [...new Set(value.map((l) => (typeof l === 'string' ? l.trim() : l)).filter((l) => l !== ''))]
      : value,
  )
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(30, { each: true })
  labels?: string[];


  @IsOptional()
  @IsIn(ISSUE_STATUSES)
  status?: IssueStatus;

  @IsOptional()
  @IsIn(ISSUE_PRIORITIES)
  priority?: IssuePriority;
}
