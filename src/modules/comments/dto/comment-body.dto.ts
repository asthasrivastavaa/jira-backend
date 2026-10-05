import { IsString, MaxLength } from 'class-validator';

export class CommentBodyDto {
  // HTML length, so a little more room than the visible text
  @IsString()
  @MaxLength(20_000)
  body: string;
}
