import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

export type McpIdentity = {
  userId: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  /** Bearer token the dispatcher uses to call the REST API. */
  apiToken: string;
  via: 'jwt' | 'service-token';
};

/**
 * Two ways in:
 *  - a normal Helm access token (the one the web app uses) — forwarded as-is;
 *  - MCP_SERVICE_TOKEN, a long-lived shared secret for headless clients such
 *    as a ChatGPT connector, mapped to MCP_SERVICE_USER_EMAIL and exchanged
 *    for a short-lived JWT on every call.
 */
@Injectable()
export class McpAuthService {
  private readonly logger = new Logger(McpAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async resolve(rawToken: string | undefined): Promise<McpIdentity> {
    const token = (rawToken ?? '').trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const serviceToken = this.config.get<string>('MCP_SERVICE_TOKEN');
    if (serviceToken && token.length === serviceToken.length && token === serviceToken) {
      return this.asServiceUser();
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET') || '',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    return {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      apiToken: token,
      via: 'jwt',
    };
  }

  private async asServiceUser(): Promise<McpIdentity> {
    const email =
      this.config.get<string>('MCP_SERVICE_USER_EMAIL') ??
      this.config.get<string>('ADMIN_EMAIL') ??
      '';
    const user = await this.users.findByIdentifier(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        `MCP service user "${email}" not found or inactive. Set MCP_SERVICE_USER_EMAIL to an active Helm user.`,
      );
    }

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    const apiToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET') || '',
      expiresIn: '10m',
    } as any);

    return {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      apiToken,
      via: 'service-token',
    };
  }
}
