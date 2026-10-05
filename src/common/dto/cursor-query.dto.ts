import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';

/**
 * Cursor pagination: "give me `limit` items older than `cursor` (newest first)".
 * The cursor is the _id of the last item the client already has (ObjectIds grow over time).
 */
export class CursorQueryDto {
  @IsOptional()
  @IsMongoId()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
