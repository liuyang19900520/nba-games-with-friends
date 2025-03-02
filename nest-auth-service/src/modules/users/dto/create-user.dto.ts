import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 50)
  username: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'Phone number is not valid' })
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 50)
  nick_name: string;

  @IsNotEmpty()
  @IsString()
  @Length(8, 100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/, {
    message: 'Password too weak',
  })
  password: string;
}
