import { createHash } from 'node:crypto';
import type { DiscordConfig } from './config.js';

export interface DiscordMessageAuthor {
  id: string;
  username: string;
  discriminator?: string;
  bot?: boolean;
}

export interface DiscordAttachmentMeta {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url?: string;
  content_type?: string;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: DiscordMessageAuthor;
  content: string;
  timestamp: string;
  attachments: DiscordAttachmentMeta[];
  thread?: { id: string };
}

export interface FetchedAttachment {
  id: string;
  filename: string;
  byteSize: number;
  sha256: string;
  contentText: string;
  url: string;
}

export class DiscordApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'DiscordApiError';
  }
}

export interface DiscordClientOptions {
  config: DiscordConfig;
  fetchFn?: typeof fetch;
}

export class DiscordRestClient {
  private readonly config: DiscordConfig;
  private readonly fetchFn: typeof fetch;

  constructor(options: DiscordClientOptions) {
    this.config = options.config;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bot ${this.config.botToken}`,
      'User-Agent': 'RoomTreasuryBot (https://roomtreasury.local, 0.1.0)',
      ...extra,
    };
  }

  async sendMessage(channelId: string, content: string): Promise<DiscordMessage> {
    const url = `${this.config.apiBaseUrl}/channels/${encodeURIComponent(channelId)}/messages`;
    return this.requestWithRetry<DiscordMessage>(url, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: ['users', 'roles'] },
      }),
    });
  }

  async getMessages(channelId: string, options: { after?: string | undefined; limit?: number | undefined } = {}): Promise<DiscordMessage[]> {
    const params = new URLSearchParams();
    if (options.after) params.set('after', options.after);
    if (options.limit) params.set('limit', String(Math.min(100, Math.max(1, options.limit))));
    const query = params.toString();
    const url = `${this.config.apiBaseUrl}/channels/${encodeURIComponent(channelId)}/messages${query ? '?' + query : ''}`;
    return this.requestWithRetry<DiscordMessage[]>(url, {
      method: 'GET',
      headers: this.headers(),
    });
  }

  async fetchAttachment(attachment: DiscordAttachmentMeta, maxBytes: number): Promise<FetchedAttachment> {
    const parsed = new URL(attachment.url);
    const allowedHosts = ['cdn.discordapp.com', 'media.discordapp.net'];
    if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
      throw new DiscordApiError(400, 'UNTRUSTED_ATTACHMENT_URL', `Attachment URL host ${parsed.hostname} is not an authorized Discord CDN.`);
    }

    if (attachment.size > maxBytes) {
      throw new DiscordApiError(400, 'ATTACHMENT_TOO_LARGE', `Attachment ${attachment.filename} (${attachment.size} bytes) exceeds limit of ${maxBytes} bytes.`);
    }

    const response = await this.fetchFn(attachment.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RoomTreasuryBot (https://roomtreasury.local, 0.1.0)',
      },
    });

    if (!response.ok) {
      throw new DiscordApiError(response.status, 'ATTACHMENT_FETCH_FAILED', `Failed to download attachment ${attachment.filename}: HTTP ${response.status}.`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.byteLength > maxBytes) {
      throw new DiscordApiError(400, 'ATTACHMENT_TOO_LARGE', `Downloaded attachment ${attachment.filename} (${buffer.byteLength} bytes) exceeds limit of ${maxBytes} bytes.`);
    }

    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const contentText = buffer.toString('utf8');

    return {
      id: attachment.id,
      filename: attachment.filename,
      byteSize: buffer.byteLength,
      sha256,
      contentText,
      url: attachment.url,
    };
  }

  private async requestWithRetry<T>(url: string, init: RequestInit, retries = 2): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      let response: Response;
      try {
        response = await this.fetchFn(url, init);
      } catch (err) {
        if (attempt === retries) {
          throw new DiscordApiError(0, 'NETWORK_ERROR', 'Discord API network request failed.');
        }
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }

      if (response.status === 429) {
        let retryAfterMs = 1000;
        try {
          const body = await response.json();
          if (typeof body.retry_after === 'number') {
            retryAfterMs = Math.ceil(body.retry_after * 1000);
          }
        } catch {
          const header = response.headers.get('Retry-After');
          if (header && /^\d+$/.test(header)) {
            retryAfterMs = parseInt(header, 10) * 1000;
          }
        }

        if (attempt < retries && retryAfterMs <= 5000) {
          await new Promise((r) => setTimeout(r, retryAfterMs));
          continue;
        }
        throw new DiscordApiError(429, 'RATE_LIMITED', `Discord rate limit exceeded; retry after ${retryAfterMs}ms.`, retryAfterMs);
      }

      if (!response.ok) {
        let code = 'DISCORD_API_ERROR';
        let message = `Discord API returned HTTP ${response.status}.`;
        try {
          const errBody = await response.json();
          if (errBody?.code) code = `DISCORD_${errBody.code}`;
          if (errBody?.message) message = `Discord API: ${errBody.message}`;
        } catch {
          // keep generic message
        }
        throw new DiscordApiError(response.status, code, message);
      }

      return (await response.json()) as T;
    }

    throw new DiscordApiError(0, 'DISCORD_REQUEST_EXHAUSTED', 'Discord API request retries exhausted.');
  }
}
