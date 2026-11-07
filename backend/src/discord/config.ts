export interface DiscordConfig {
  readonly botToken: string;
  readonly guildId: string;
  readonly channelId: string;
  readonly coordinatorMention: string;
  readonly apiBaseUrl: string;
  readonly gatewayUrl: string;
  readonly jobTimeoutMs: number;
}

export class DiscordConfigurationError extends Error {
  constructor(message = 'Invalid Discord transport configuration.') {
    super(message);
    this.name = 'DiscordConfigurationError';
  }
}

const SNOWFLAKE_PATTERN = /^\d{17,21}$/;

function tryLoadEnv(env: NodeJS.ProcessEnv): void {
  if (env === process.env && !env.DISCORD_BOT_TOKEN) {
    try {
      if (typeof (process as any).loadEnvFile === 'function') {
        (process as any).loadEnvFile('.env');
      }
    } catch {
      // .env file missing or unreadable; proceed with process.env
    }
  }
}

export function hasDiscordConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  tryLoadEnv(env);
  return typeof env.DISCORD_BOT_TOKEN === 'string' && env.DISCORD_BOT_TOKEN.trim().length > 0;
}

export function readDiscordConfig(env: NodeJS.ProcessEnv = process.env): DiscordConfig {
  tryLoadEnv(env);
  const rawToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!rawToken || rawToken.length < 20) {
    throw new DiscordConfigurationError('DISCORD_BOT_TOKEN is required and must be configured.');
  }

  // Token sanity: no newlines, spaces, or control characters.
  if (/[\s\r\n\t]/.test(rawToken)) {
    throw new DiscordConfigurationError('DISCORD_BOT_TOKEN contains invalid whitespace characters.');
  }

  const guildId = (env.DISCORD_GUILD_ID?.trim() || '1567957507656384543');
  if (!SNOWFLAKE_PATTERN.test(guildId)) {
    throw new DiscordConfigurationError('DISCORD_GUILD_ID must be a valid Discord snowflake ID (17-21 digits).');
  }

  const channelId = (env.DISCORD_CHANNEL_ID?.trim() || '1567957508985847880');
  if (!SNOWFLAKE_PATTERN.test(channelId)) {
    throw new DiscordConfigurationError('DISCORD_CHANNEL_ID must be a valid Discord snowflake ID (17-21 digits).');
  }

  const coordinatorMention = env.DISCORD_COORDINATOR_MENTION?.trim() || (guildId === '1567957507656384543' ? '<@&1568256403179569252>' : '@make-proposal-agent');
  const apiBaseUrl = (env.DISCORD_API_BASE_URL?.trim() || 'https://discord.com/api/v10').replace(/\/+$/, '');
  const gatewayUrl = env.DISCORD_GATEWAY_URL?.trim() || 'wss://gateway.discord.gg/?v=10&encoding=json';
  const rawTimeout = env.DISCORD_JOB_TIMEOUT_MS?.trim();
  const jobTimeoutMs = rawTimeout && /^\d+$/.test(rawTimeout) ? Number(rawTimeout) : 900000; // 15 minutes default

  return Object.freeze({
    botToken: rawToken,
    guildId,
    channelId,
    coordinatorMention,
    apiBaseUrl,
    gatewayUrl,
    jobTimeoutMs,
  });
}

