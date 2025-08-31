import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@smartcity.rs',
    description: 'Email adresa korisnika',
  })
  @IsEmail({}, { message: 'Email mora biti valjan' })
  email: string;

  @ApiProperty({
    example: 'Test123!',
    description: 'Lozinka korisnika',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Lozinka mora imati najmanje 6 karaktera' })
  password: string;
}