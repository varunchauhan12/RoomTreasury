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

// Never persist Discord response text: it can echo submitted content or secrets.
export function dispatchDiagnostic(error: unknown): string {
  if (!(error instanceof DiscordApiError)) return 'unknown_dispatch_outcome';
  const status = error.statusCode;
  const category = status === 401 ? 'authentication_failure'
    : error.code === 'DISCORD_50001' ? 'missing_access'
    : status === 404 ? 'guild_channel_not_found'
    : status === 403 ? 'missing_permissions'
    : status === 400 ? 'invalid_message_payload'
    : status === 429 ? 'rate_limited'
    : status === 0 ? 'network_failure' : 'unknown_dispatch_outcome';
  const code = /^DISCORD_\d{1,8}$/.test(error.code) ? error.code.slice(8) : 'none';
  return `${category}; http=${status}; discord=${code}`;
}

export function safeDispatchDiagnostic(value: string | null): string | null {
  return value && /^(authentication_failure|missing_access|guild_channel_not_found|missing_permissions|invalid_message_payload|rate_limited|network_failure|unknown_dispatch_outcome)(; http=\d{1,3}; discord=(none|\d{1,8}))?$/.test(value) ? value : null;
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

  async sendMessage(channelId: string, content: string, attachment?: { filename: string; content: string }): Promise<DiscordMessage> {
    if (content.length > 2000) {
      throw new DiscordApiError(400, 'MESSAGE_TOO_LONG', 'Discord message content exceeds 2000 characters.');
    }
    const url = `${this.config.apiBaseUrl}/channels/${encodeURIComponent(channelId)}/messages`;
    const role = /^<@&(\d{17,21})>$/.exec(this.config.coordinatorMention)?.[1];
    const user = /^<@!?(\d{17,21})>$/.exec(this.config.coordinatorMention)?.[1];
    const payload = {
      content,
      allowed_mentions: { parse: [], roles: role ? [role] : [], users: user ? [user] : [] },
      ...(attachment ? { attachments: [{ id: 0, filename: attachment.filename }] } : {}),
    };
    let body: string | FormData = JSON.stringify(payload);
    if (attachment) {
      body = new FormData();
      body.set('payload_json', JSON.stringify(payload));
      body.set('files[0]', new Blob([attachment.content], { type: 'text/plain; charset=utf-8' }), attachment.filename);
    }
    return this.requestWithRetry<DiscordMessage>(url, {
      method: 'POST',
      headers: this.headers(attachment ? {} : { 'Content-Type': 'application/json' }),
      body,
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
        response = await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(15000) });
      } catch (err) {
        // A POST may have been accepted before the connection failed. Never resend it.
        if (init.method === 'POST' || attempt === retries) {
          throw new DiscordApiError(0, 'NETWORK_ERROR', 'Discord API network request failed.');
        }
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }

      if (response.status === 429) {
        let retryAfterMs = 1000;
        try {
          const body = await response.json();
          if (typeof body.retry_after === 'number' && Number.isFinite(body.retry_after) && body.retry_after >= 0) {
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
        const message = `Discord API returned HTTP ${response.status}.`;
        try {
          const errBody = await response.json();
          if (Number.isSafeInteger(errBody?.code) && errBody.code >= 0 && errBody.code <= 99999999) code = `DISCORD_${errBody.code}`;
        } catch {
          // keep generic message
        }
        throw new DiscordApiError(response.status, code, message);
      }

      try {
        return (await response.json()) as T;
      } catch {
        // A successful POST with an unreadable acknowledgement may already be delivered.
        throw new DiscordApiError(response.status, 'INVALID_RESPONSE', 'Discord returned an unreadable acknowledgement.');
      }
    }

    throw new DiscordApiError(0, 'DISCORD_REQUEST_EXHAUSTED', 'Discord API request retries exhausted.');
  }
}
