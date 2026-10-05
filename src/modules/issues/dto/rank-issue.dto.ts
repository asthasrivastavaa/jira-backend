import { IsMongoId, IsOptional, ValidateIf } from 'class-validator';

/** Backlog drag & drop: which list (a sprint, or null = backlog) and between which two issues. */
export class RankIssueDto {
  // required, but may be null: ValidateIf skips the id check only for an explicit null
  @ValidateIf((o: RankIssueDto) => o.sprintId !== null)
  @IsMongoId({ message: 'sprintId must be a sprint id or null (backlog)' })
  sprintId: string | null;

  /** the issue that ends up directly ABOVE (omit at the top) */
  @IsOptional()
  @IsMongoId()
  beforeId?: string;

  /** the issue that ends up directly BELOW (omit at the bottom) */
  @IsOptional()
  @IsMongoId()
  afterId?: string;
}
