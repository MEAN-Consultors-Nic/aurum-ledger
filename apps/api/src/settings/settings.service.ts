import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CredentialCipher } from '../common/crypto/credential-cipher';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { Setting, SettingDocument } from './schemas/setting.schema';

export type GithubSettings = {
  org: string;
  autoCreate: boolean;
  defaultPrivate: boolean;
  hasToken: boolean;
};

const GITHUB_KEYS = {
  org: 'githubOrg',
  token: 'githubAccessToken', // encrypted
  autoCreate: 'githubAutoCreateRepos',
  defaultPrivate: 'githubDefaultPrivate',
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private readonly settingModel: Model<SettingDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    private readonly cipher: CredentialCipher,
  ) {}

  async getAll() {
    return this.settingModel.find().sort({ key: 1 });
  }

  async getValue(key: string) {
    const setting = await this.settingModel.findOne({ key });
    return setting?.value ?? null;
  }

  async setValue(key: string, value: string, userId?: string) {
    return this.settingModel.findOneAndUpdate(
      { key },
      { key, value, updatedBy: userId },
      { upsert: true, new: true },
    );
  }

  async getNumber(key: string) {
    const value = await this.getValue(key);
    if (value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  async getDefaultPaymentCategoryId() {
    const configured = await this.getValue('defaultPaymentCategoryId');
    if (configured) {
      return configured;
    }

    const fallback = await this.categoryModel.findOne({ name: 'Work', type: 'income' });
    return fallback?._id?.toString() ?? null;
  }

  // ----- GitHub settings -----

  async getGithubSettings(): Promise<GithubSettings> {
    const [org, token, autoCreate, defaultPrivate] = await Promise.all([
      this.getValue(GITHUB_KEYS.org),
      this.getValue(GITHUB_KEYS.token),
      this.getValue(GITHUB_KEYS.autoCreate),
      this.getValue(GITHUB_KEYS.defaultPrivate),
    ]);
    return {
      org: org ?? '',
      autoCreate: autoCreate === 'true',
      defaultPrivate: defaultPrivate !== 'false', // default to true
      hasToken: !!token,
    };
  }

  async updateGithubSettings(
    payload: { org?: string; token?: string | null; autoCreate?: boolean; defaultPrivate?: boolean },
    userId?: string,
  ) {
    if (payload.org !== undefined) {
      await this.setValue(GITHUB_KEYS.org, payload.org.trim(), userId);
    }
    if (payload.autoCreate !== undefined) {
      await this.setValue(GITHUB_KEYS.autoCreate, payload.autoCreate ? 'true' : 'false', userId);
    }
    if (payload.defaultPrivate !== undefined) {
      await this.setValue(
        GITHUB_KEYS.defaultPrivate,
        payload.defaultPrivate ? 'true' : 'false',
        userId,
      );
    }
    if (payload.token !== undefined) {
      if (payload.token === null || payload.token === '') {
        await this.settingModel.deleteOne({ key: GITHUB_KEYS.token });
      } else {
        const blob = this.cipher.encrypt({ token: payload.token });
        await this.setValue(GITHUB_KEYS.token, blob, userId);
      }
    }
    return this.getGithubSettings();
  }

  /**
   * Returns the decrypted GitHub token, or null if not configured.
   * Internal use only — never expose this to clients.
   */
  async getGithubAccessToken(): Promise<string | null> {
    const blob = await this.getValue(GITHUB_KEYS.token);
    if (!blob) return null;
    try {
      const decoded = this.cipher.decrypt(blob);
      const token = decoded.token;
      return typeof token === 'string' ? token : null;
    } catch {
      return null;
    }
  }
}
