import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestEmailTemplateDto {
  @ApiProperty({ description: 'Email address to send test email to' })
  @IsNotEmpty()
  @IsEmail()
  testEmail: string;
}