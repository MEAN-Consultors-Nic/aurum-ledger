import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TEXT_MODEL = 'gpt-4o-mini';
const DEFAULT_VISION_MODEL = 'gpt-4o';
const API_URL = 'https://api.openai.com/v1/chat/completions';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | (
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      )[];
};

export type ChatOptions = {
  model?: string;
  temperature?: number;
  /** When true, force the model to return parseable JSON. */
  json?: boolean;
  maxTokens?: number;
};

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly apiKey: string | null;
  readonly textModel: string;
  readonly visionModel: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY') ?? null;
    this.textModel = config.get<string>('OPENAI_TEXT_MODEL') ?? DEFAULT_TEXT_MODEL;
    this.visionModel =
      config.get<string>('OPENAI_VISION_MODEL') ?? DEFAULT_VISION_MODEL;
    if (!this.apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY missing — AI analyses will be skipped and return empty strings',
      );
    }
  }

  get isReady() {
    return !!this.apiKey;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('OpenAI is not configured');
    }
    const body: Record<string, unknown> = {
      model: opts.model ?? this.textModel,
      messages,
      temperature: opts.temperature ?? 0.4,
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts.json) body.response_format = { type: 'json_object' };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
      throw new Error(`OpenAI ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  /** Try-best wrapper for JSON output. Returns null on error rather than throwing. */
  async chatJson<T>(messages: ChatMessage[], opts: ChatOptions = {}): Promise<T | null> {
    try {
      const raw = await this.chat(messages, { ...opts, json: true });
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`OpenAI JSON parse failed: ${(err as Error).message}`);
      return null;
    }
  }
}
