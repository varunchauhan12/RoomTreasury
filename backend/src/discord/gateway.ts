import { EventEmitter } from 'node:events';
import type { DiscordConfig } from './config.js';
import type { DiscordMessage } from './client.js';

export interface DiscordGatewayEvents {
  message_create: (message: DiscordMessage) => void;
  ready: (data: { user: { id: string; username: string }; session_id: string }) => void;
  error: (err: Error) => void;
  close: (code: number, reason: string) => void;
}

export interface DiscordGatewayOptions {
  config: DiscordConfig;
  WebSocketClass?: typeof WebSocket;
}

export class DiscordGateway extends EventEmitter {
  private readonly config: DiscordConfig;
  private readonly WebSocketClass: typeof WebSocket;
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sequence: number | null = null;
  private sessionId: string | null = null;
  private resumeGatewayUrl: string | null = null;
  private closedExplicitly = false;

  constructor(options: DiscordGatewayOptions) {
    super();
    this.config = options.config;
    this.WebSocketClass = options.WebSocketClass ?? globalThis.WebSocket;
  }

  connect(): void {
    this.closedExplicitly = false;
    const url = this.resumeGatewayUrl || this.config.gatewayUrl;
    const ws = new this.WebSocketClass(url);
    this.ws = ws;

    ws.onopen = () => {
      // Waiting for Op 10 Hello
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
        this.handlePayload(payload);
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error('Invalid Gateway payload'));
      }
    };

    ws.onerror = (event: any) => {
      const errorMsg = event?.message || 'Discord Gateway WebSocket error';
      this.emit('error', new Error(errorMsg));
    };

    ws.onclose = (event) => {
      this.cleanup();
      this.emit('close', event.code, event.reason);
      if (!this.closedExplicitly) {
        // Attempt reconnect if not explicitly closed
        setTimeout(() => {
          if (!this.closedExplicitly) this.connect();
        }, 1000).unref();
      }
    };
  }

  private handlePayload(payload: { op: number; d: any; s?: number; t?: string }): void {
    if (typeof payload.s === 'number') {
      this.sequence = payload.s;
    }

    switch (payload.op) {
      case 10: { // Hello
        const heartbeatInterval = payload.d.heartbeat_interval;
        this.startHeartbeat(heartbeatInterval);
        if (this.sessionId && this.sequence !== null) {
          this.sendResume();
        } else {
          this.sendIdentify();
        }
        break;
      }
      case 11: { // Heartbeat ACK
        break;
      }
      case 1: { // Immediate heartbeat request
        this.sendHeartbeat();
        break;
      }
      case 7: { // Reconnect requested
        this.ws?.close(4000, 'Reconnect requested');
        break;
      }
      case 9: { // Invalid session
        const resumable = payload.d === true;
        if (!resumable) {
          this.sessionId = null;
          this.sequence = null;
        }
        this.ws?.close(4000, 'Invalid session');
        break;
      }
      case 0: { // Dispatch
        this.handleDispatch(payload.t!, payload.d);
        break;
      }
    }
  }

  private handleDispatch(event: string, data: any): void {
    if (event === 'READY') {
      this.sessionId = data.session_id;
      this.resumeGatewayUrl = data.resume_gateway_url ? `${data.resume_gateway_url}?v=10&encoding=json` : null;
      this.emit('ready', { user: data.user, session_id: data.session_id });
    } else if (event === 'MESSAGE_CREATE') {
      this.emit('message_create', data as DiscordMessage);
    }
  }

  private startHeartbeat(intervalMs: number): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
    this.heartbeatTimer.unref();
    // First heartbeat jitter
    setTimeout(() => this.sendHeartbeat(), Math.floor(Math.random() * intervalMs * 0.5)).unref();
  }

  private sendHeartbeat(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: 1, d: this.sequence }));
    }
  }

  private sendIdentify(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const identifyPayload = {
      op: 2,
      d: {
        token: this.config.botToken,
        intents: 1 | 512 | 32768, // GUILDS (1) | GUILD_MESSAGES (512) | MESSAGE_CONTENT (32768)
        properties: {
          os: 'darwin',
          browser: 'RoomTreasury',
          device: 'RoomTreasury',
        },
      },
    };
    this.ws.send(JSON.stringify(identifyPayload));
  }

  private sendResume(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const resumePayload = {
      op: 6,
      d: {
        token: this.config.botToken,
        session_id: this.sessionId,
        seq: this.sequence,
      },
    };
    this.ws.send(JSON.stringify(resumePayload));
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  close(): void {
    this.closedExplicitly = true;
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
  }
}

