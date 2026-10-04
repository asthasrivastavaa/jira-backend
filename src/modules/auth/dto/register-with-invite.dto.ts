import { IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterWithInviteDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
