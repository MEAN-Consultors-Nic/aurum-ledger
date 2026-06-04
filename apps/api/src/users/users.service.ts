import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {}

  async ensureAdminSeeded() {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');
    const adminUsername = this.config.get<string>('ADMIN_USERNAME');
    if (!adminEmail || !adminPassword) {
      return;
    }

    const existing = await this.userModel.findOne({ email: adminEmail });
    if (existing) {
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await this.userModel.create({
      name: 'Admin',
      username: (adminUsername || adminEmail.split('@')[0]).toLowerCase(),
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: 'admin',
      isActive: true,
    });
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      name: dto.name,
      username: dto.username.toLowerCase(),
      email: dto.email.toLowerCase(),
      passwordHash,
      role: dto.role ?? 'staff',
      isActive: true,
    });

    return this.toResponse(user);
  }

  async findAll() {
    const users = await this.userModel.find().sort({ createdAt: -1 });
    return users.map((user) => this.toResponse(user));
  }

  async findById(id: string) {
    return this.userModel.findById(id);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findByIdentifier(identifier: string) {
    const value = identifier.toLowerCase();
    return this.userModel.findOne({
      $or: [{ email: value }, { username: value }],
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const { password, ...restDto } = dto;
    const updatePayload: Partial<User> = {
      ...restDto,
    };

    if (dto.email) {
      updatePayload.email = dto.email.toLowerCase();
    }
    if (dto.username) {
      updatePayload.username = dto.username.toLowerCase();
    }

    if (password) {
      updatePayload.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await this.userModel.findByIdAndUpdate(id, updatePayload, {
      new: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  async toggleActive(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = !user.isActive;
    await user.save();

    return this.toResponse(user);
  }

  async updateRefreshToken(userId: Types.ObjectId, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    const ttlDays = Number(this.config.get<string>('JWT_REFRESH_TTL_DAYS') ?? 7);
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    await this.userModel.findByIdAndUpdate(userId, {
      refreshTokenHash,
      refreshTokenExpiresAt: expiresAt,
    });
  }

  async clearRefreshToken(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 },
    });
  }

  private toResponse(user: UserDocument) {
    const userObj = user.toObject() as User & { createdAt?: Date; updatedAt?: Date };
    return {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: userObj.createdAt,
      updatedAt: userObj.updatedAt,
    };
  }
}
