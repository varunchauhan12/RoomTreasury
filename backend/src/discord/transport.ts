import type { Database } from 'better-sqlite3';
import type { DispatchRequest, JobTransport, TransportEvent } from '../jobs/transport.js';
import { DispatchFailure } from '../jobs/transport.js';
import { DiscordConfig } from './config.js';
import { DiscordRestClient, DiscordMessage, DiscordApiError, dispatchDiagnostic } from './client.js';
import { DiscordGateway } from './gateway.js';
import { DiscordMessageCollector, classifySender } from './collector.js';
import { importDiscordPackage } from '../imports/project-linked.js';
import { ImportError } from '../imports/service.js';

export interface DiscordTransportOptions {
  db: Database;
  config: DiscordConfig;
  client?: DiscordRestClient;
  gateway?: DiscordGateway;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export class DiscordTransport implements JobTransport {
  readonly type = 'discord' as const;
  private readonly db: Database;
  private readonly config: DiscordConfig;
  private readonly client: DiscordRestClient;
  private readonly gateway: DiscordGateway | null;
  private readonly ownsGateway: boolean;
  private readonly collector: DiscordMessageCollector;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(options: DiscordTransportOptions) {
    this.db = options.db;
    this.config = options.config;
    this.client = options.client ?? new DiscordRestClient({ config: options.config });
    if (options.gateway !== undefined) {
      this.gateway = options.gateway;
      this.ownsGateway = false;
    } else if (!options.client && options.config.botToken) {
      this.gateway = new DiscordGateway({ config: options.config });
      this.ownsGateway = true;
    } else {
      this.gateway = null;
      this.ownsGateway = false;
    }
    this.collector = new DiscordMessageCollector(this.db, this.config, this.client);
    this.pollIntervalMs = options.pollIntervalMs ?? (this.gateway ? 1000 : 500);
    this.timeoutMs = options.timeoutMs ?? options.config.jobTimeoutMs ?? 900000;
  }

  async dispatch(request: DispatchRequest): Promise<{ correlationId: string; messageId?: string }> {
    const mention = this.config.coordinatorMention;
    const brief = request.brief ?? 'No project brief provided.';
    const intakeRevision = request.intakeRevision ?? 1;

    const messageLines = [
      `${mention}`,
      '',
      '**[ROOMTREASURY INTAKE DISPATCH]**',
      'Please coordinate the specialist agents (Request Agent, Challenge Agent, Commitment Intelligence Agent, Treasury Operations Agent) to analyze this project brief and produce a final proposal package (`proposal.json`, `evidence.json`, `summary.md`).',
      '',
      '**Authoritative Task Binding:**',
      `- Project ID: \`${request.projectId ?? 'unknown'}\``,
      `- Task ID: \`${request.taskId ?? 'unknown'}\``,
      `- Processing Job ID: \`${request.jobId}\``,
      `- Correlation ID: \`${request.correlationId}\``,
      `- Intake Revision: \`${intakeRevision}\``,
      `- Intake SHA-256: \`${request.intakeHash}\``,
      `- Client: ${request.clientName ?? 'Client'}`,
      `- Proposed Revenue Target: ${request.revenueCents !== undefined ? `$${(request.revenueCents / 100).toFixed(2)}` : 'Unspecified'} (${request.revenueCents ?? 0} cents ${request.currency ?? 'USD'}) [PROPOSED ESTIMATE — NOT AGREED OR RECEIVED REVENUE]`,
      '',
      '**Original Project Brief:**',
      '```',
      brief,
      '```',
      '',
      '**Specialist Coordination Instructions:**',
      '1. Coordinate all four specialists to gather requirements, identify risks, estimate capacity and commitments, and analyze economics.',
      '2. Consolidate their findings into the final proposal package (`proposal.json`, `evidence.json`, `summary.md`).',
      '3. When complete, upload all three artifact files as attachments and post the completion marker:',
      `   \`ROOMTREASURY_RESULT_READY job=${request.jobId} correlation=${request.correlationId}\``,
      '4. IMPORTANT: Do NOT approve, spend, reserve, settle or deploy funds. All spending is simulated and requires explicit human owner review in RoomTreasury.',
    ];

    const fullContent = messageLines.join('\n');
    // One atomic Discord message, rather than activating the coordinator with a partial brief.
    const attachment = fullContent.length > 2000 ? { filename: 'roomtreasury-intake.txt', content: fullContent } : undefined;
    const content = attachment
      ? messageLines.map((line, index) => index === messageLines.indexOf(brief) ? 'Read the complete original brief in the attached roomtreasury-intake.txt before coordinating.' : line).join('\n')
      : fullContent;

    let accepted = false;
    try {
      const sent = await this.client.sendMessage(this.config.channelId, content, attachment);
      accepted = true;
      if (!sent.id || sent.channel_id !== this.config.channelId) throw new Error('Invalid acknowledgement');
      this.collector.updateCheckpoint(this.config.channelId, sent.id);
      return { correlationId: request.correlationId, messageId: sent.id };
    } catch (err: unknown) {
      const certain = !accepted && err instanceof DiscordApiError && [400, 401, 403, 404, 429].includes(err.statusCode);
      throw new DispatchFailure(certain, 'Discord dispatch failed.', accepted ? 'unknown_dispatch_outcome' : dispatchDiagnostic(err));
    }
  }

  async *events(request: DispatchRequest): AsyncIterable<TransportEvent> {
    const { jobId, correlationId, taskId } = request;
    const startTime = Date.now();
    let isRunning = false;
    let isCollecting = false;
    let isValidating = false;
    const seenSpecialists = new Set<string>();
    const correlatedMessages: DiscordMessage[] = [];

    // Gateway subscription
    const liveMessages: DiscordMessage[] = [];
    let messageHandler: ((msg: DiscordMessage) => void) | null = null;
    // An unhandled EventEmitter error terminates Node; continue with REST backfill.
    const gatewayErrorHandler = () => {};

    if (this.gateway) {
      this.gateway.on('error', gatewayErrorHandler);
      messageHandler = (msg: DiscordMessage) => {
        if (this.collector.filterMessage(msg) && (this.collector.isCorrelated(msg, jobId, correlationId, taskId)||msg.attachments.length>0&&classifySender(msg.author.username,!!msg.author.bot).role==='coordinator')) {
          liveMessages.push(msg);
        }
      };
      this.gateway.on('message_create', messageHandler);
      if (this.ownsGateway) {
        try {
          this.gateway.connect();
        } catch {
          // Gracefully continue with REST history backfill
        }
      }
    }

    let lastBackfillTime = 0;
    const backfillThrottleMs = this.gateway ? 10000 : this.pollIntervalMs;

    try {
      while (Date.now() - startTime < this.timeoutMs) {
        const incoming: DiscordMessage[] = [];

        // REST backfill on schedule or at start
        const now = Date.now();
        if (now - lastBackfillTime >= backfillThrottleMs) {
          lastBackfillTime = now;
          const backfilled = await this.collector.backfillHistory(jobId, correlationId, taskId);
          for (const b of backfilled) {
            incoming.push(b.message);
          }
        }

        // Live gateway messages
        incoming.push(...liveMessages.splice(0, liveMessages.length));

        incoming.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
        for (const msg of incoming) {
          if(!await this.collector.correlateMessage(msg,jobId,correlationId,taskId))continue;
          const classified = this.collector.recordMessage(msg, jobId);
          if (!classified) continue;
          correlatedMessages.push(msg);

          if (!isRunning && (classified.isCoordinatorAck || classified.role === 'coordinator' || classified.isSpecialistProgress)) {
            isRunning = true;
            yield { key: 'discord-running', state: 'running' };
          }

          if (classified.role === 'specialist' && classified.agentName) {
            if (!seenSpecialists.has(classified.agentName)) {
              seenSpecialists.add(classified.agentName);
              yield { key: `discord-specialist-${classified.agentName}`, state: 'running' };
            }
          }

          // When all 4 specialists have been observed or specialist phase is collecting
          if (seenSpecialists.size >= 4 && !isCollecting) {
            isCollecting = true;
            yield { key: 'discord-collecting', state: 'collecting' };
          }

          if (classified.isCompletionMarker) {
            if (!isCollecting) {
              isCollecting = true;
              yield { key: 'discord-collecting', state: 'collecting' };
            }
            isValidating = true;
            yield { key: 'discord-validating', state: 'validating' };
            break;
          }
        }

        if (isValidating) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }

      if (!isValidating) {
        yield { key: 'discord-timeout', state: 'needs_attention', code: 'discord_timeout' };
        return;
      }

      // One final chronological backfill includes attachment-only messages before the completion marker.
      const finalBackfill=await this.collector.backfillHistory(jobId,correlationId,taskId);
      correlatedMessages.push(...finalBackfill.map(item=>item.message));
      const stored=this.db.prepare('SELECT raw_json FROM discord_messages WHERE job_id=? ORDER BY occurred_at,id').all(jobId) as {raw_json:string}[];
      correlatedMessages.push(...stored.map(row=>JSON.parse(row.raw_json) as DiscordMessage));
      // Validating phase: retrieve attachments
      let artifacts;
      try {
        artifacts = await this.collector.retrieveAttachmentsForJob(jobId, correlatedMessages);
      } catch (err: any) {
        yield {
          key: 'discord-missing-attachments',
          state: 'needs_attention',
          code: 'discord_missing_attachments',
          diagnostic: err.message?.slice(0, 200),
        };
        return;
      }

      const bundle = {
        proposal: { name: artifacts.proposal.filename, content: artifacts.proposal.contentText },
        evidence: { name: artifacts.evidence.filename, content: artifacts.evidence.contentText },
        summary: { name: artifacts.summary.filename, content: artifacts.summary.contentText },
      };

      // Import proposal into RoomTreasury
      try {
        importDiscordPackage(this.db, jobId, bundle);
        yield { key: 'discord-imported', state: 'imported' };
      } catch (err: any) {
        const issues = err instanceof ImportError ? err.issues : [err.message];
        yield {
          key: 'discord-validation-failed',
          state: 'needs_attention',
          code: 'artifact_validation_failed',
          diagnostic: issues[0]?.slice(0, 200) || 'Proposal validation failed.',
        };
      }
    } finally {
      if (this.gateway && messageHandler) {
        this.gateway.off('message_create', messageHandler);
      }
      if (this.ownsGateway && this.gateway) {
        try {
          this.gateway.close();
        } catch {}
      }
      // Owned sockets may emit an asynchronous error while closing.
      if (!this.ownsGateway) this.gateway?.off('error', gatewayErrorHandler);
    }
  }
}
