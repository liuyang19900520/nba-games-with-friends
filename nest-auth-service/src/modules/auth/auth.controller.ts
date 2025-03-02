// src/modules/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Request, Get, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenDto } from './dto/token.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<TokenDto> {
    this.logger.log('Registration request received');
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req): Promise<TokenDto> {
    this.logger.log('Login request received');
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    this.logger.log('Profile request received');
    return req.user;
  }

  @Post('validate-token')
  async validateToken(@Body() body: { token: string }) {
    this.logger.log('Token validation request received');
    return this.authService.validateToken(body.token);
  }
}
