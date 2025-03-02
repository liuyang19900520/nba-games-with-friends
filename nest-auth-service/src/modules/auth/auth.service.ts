// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { TokenDto } from './dto/token.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    try {
      const user = await this.usersService.findByUsername(username);
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (isPasswordValid) {
        const { password, ...result } = user;
        return result;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async login(user: User): Promise<TokenDto> {
    const payload = { username: user.username, sub: user.id };
    this.logger.log(`User logged in: ${user.username}`);

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<TokenDto> {
    const user = await this.usersService.create(registerDto);
    this.logger.log(`User registered: ${user.username}`);

    return this.login(user as User);
  }

  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
