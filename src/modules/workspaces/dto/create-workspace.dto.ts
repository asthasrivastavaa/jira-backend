import { Transform } from 'class-transformer';
import { IsNotIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { RESERVED_SLUGS } from '../workspace.constant.js';

export class CreateWorkspaceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Use lowercase letters, numbers and single hyphens' })
  @IsNotIn(RESERVED_SLUGS, { message: 'This URL is reserved' })
  slug: string;
}
