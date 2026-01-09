import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(identifier: string, password: string) {
    const user = await this.usersService.findByIdentifier(identifier);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user._id.toString(), user.email, user.role);
    await this.usersService.updateRefreshToken(user._id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (user.refreshTokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const match = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!match) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.issueTokens(user._id.toString(), user.email, user.role);
    await this.usersService.updateRefreshToken(user._id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(userId: string) {
    await this.usersService.clearRefreshToken(userId);
    return { success: true };
  }

  async verifyRefreshToken(refreshToken: string) {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    const payload = await this.jwtService.verifyAsync<JwtPayload & { exp: number }>(
      refreshToken,
      { secret },
    );
    return payload;
  }

  private async issueTokens(userId: string, email: string, role: 'admin' | 'staff') {
    const payload: JwtPayload = { sub: userId, email, role };
    const accessTokenExpiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '15m';
    const refreshTokenExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET') || '',
      expiresIn: accessTokenExpiresIn as string,
    } as any);
    
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET') || '',
      expiresIn: refreshTokenExpiresIn as string,
    } as any);

    return { accessToken, refreshToken };
  }
}
