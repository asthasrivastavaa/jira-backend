import { Transform } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'must be a date like 2026-10-10';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSprintDto {
  /** optional: defaults to "<KEY> Sprint <n>" */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;
}

export class UpdateSprintDto extends CreateSprintDto {
  @IsOptional()
  @Matches(DAY, { message: `startDate ${DAY_MESSAGE}` })
  startDate?: string | null;

  @IsOptional()
  @Matches(DAY, { message: `endDate ${DAY_MESSAGE}` })
  endDate?: string | null;
}

/** Starting needs real dates (the board shows "ends in 3 days"). */
export class StartSprintDto extends CreateSprintDto {
  @Matches(DAY, { message: `startDate ${DAY_MESSAGE}` })
  startDate: string;

  @Matches(DAY, { message: `endDate ${DAY_MESSAGE}` })
  endDate: string;
}

/** Where the unfinished issues go: back to the backlog, or into a planned sprint. */
export class CompleteSprintDto {
  @ValidateIf((o: CompleteSprintDto) => o.moveTo !== 'backlog')
  @IsMongoId({ message: 'moveTo must be "backlog" or a sprint id' })
  moveTo: string;
}
