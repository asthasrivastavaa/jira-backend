import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @Matches(/^[A-Za-z]{2,10}$/, {
    message: 'key must be 2-10 letters only',
  })
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
