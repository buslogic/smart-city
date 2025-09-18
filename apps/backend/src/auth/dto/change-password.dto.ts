import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'currentPassword123!',
    description: 'Trenutna lozinka korisnika',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description:
      'Nova lozinka (min 8 karaktera, mora sadržati veliko slovo, malo slovo, broj i specijalni karakter)',
  })
  @IsString()
  @MinLength(8, { message: 'Nova lozinka mora imati najmanje 8 karaktera' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Lozinka mora sadržati veliko slovo, malo slovo, broj i specijalni karakter',
  })
  newPassword: string;
}
