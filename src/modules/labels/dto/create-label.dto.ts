import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { LABEL_COLORS } from '../schemas/label.schema.js';
import type { LabelColor } from '../schemas/label.schema.js';

export class CreateLabelDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name: string;

  @IsIn(LABEL_COLORS)
  color: LabelColor;
}
