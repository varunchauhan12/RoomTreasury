import {switchAgentIds} from './config.js';
import type { Database } from 'better-sqlite3';
import type { DispatchRequest, JobTransport, TransportEvent } from '../jobs/transport.js';
import { DispatchFailure } from '../jobs/transport.js';
import { DiscordConfig } from './config.js';
import { DiscordRestClient, DiscordMessage, DiscordApiError, dispatchDiagnostic } from './client.js';
import { DiscordGateway } from './gateway.js';
import { DiscordMessageCollector, classifySender, type CollectedArtifacts } from './collector.js';
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
    const specialists=request.specialists?.length?request.specialists.join(', '):'Request Agent, Challenge Agent, Commitment Intelligence Agent, Treasury Operations Agent';

    const roster = this.config.guildId === '1567957507656384543'
      ? Object.entries(switchAgentIds).map(([name, id]) => name + '=' + id).join('; ')
      : null;

    const messageLines = [
      `${mention}`,
      '',
      '**[ROOMTREASURY INTAKE DISPATCH]**',
      'Please coordinate the specialist agents ('+specialists+') to analyze this project brief and produce a final proposal package (`proposal.json`, `evidence.json`, `summary.md`).',
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
      ...(request.changeInstructions?[
       '**Owner-authorized change request:**',request.changeInstructions,
       'Affected sections: '+request.affectedSections?.join(', '),
       'Specialists requested: '+request.specialists?.join(', '),
       'Previous proposal revision: '+request.sourceRevisionId,
       'Previous proposal fingerprint: '+request.sourceFingerprint,
       '**Previous proposal content (reference only; prior approvals do not transfer):**',
       request.sourceProposal??'No previous proposal package exists.',
       'Return a complete new bound artifact package preserving the original project brief. Keep agreed revenue null for fresh owner verification. Identify retained historical findings as historical evidence; do not claim those specialists reran. Do not reuse previous approval.'
      ]:[]),
      '**Specialist Coordination Instructions:**',
      ...(roster ? [
        'Switch room roster (internal IDs): ' + roster,
        'Before delegating, use list_participants to verify each specialist ID. Use its matched name with send_targeted_message. Report missing IDs; do not substitute.',
      ] : []),
      '1. Coordinate '+(request.specialists?.length?'the listed specialists for the affected sections':'all four specialists to gather requirements, identify risks, estimate capacity and commitments, and analyze economics')+'.',
      '2. Consolidate their findings into the final proposal package (`proposal.json`, `evidence.json`, `summary.md`).',
      '3. Both JSON files must include projectId, taskId, processingJobId, correlationId, intakeRevision and intakeSha256. Repeat those identifiers in summary.md with an Intake revision line. Keep agreed revenue null. Upload all three files, then post:',
      `   \`ROOMTREASURY_RESULT_READY job=${request.jobId} correlation=${request.correlationId}\``,
      '4. IMPORTANT: Do NOT approve, spend, reserve, settle or deploy funds. All spending is simulated and requires explicit human owner review in RoomTreasury.',
    ];

    const fullContent = messageLines.join('\n');
    // One atomic Discord message, rather than activating the coordinator with a partial brief.
    const attachment = fullContent.length > 2000 ? { filename: 'roomtreasury-intake.txt', content: fullContent } : undefined;
    const content = attachment
      ? [mention,'','**[ROOMTREASURY INTAKE DISPATCH]**',...messageLines.slice(5,14),
          'Read the complete original brief and Switch routing instructions in roomtreasury-intake.txt before coordinating.',
          `ROOMTREASURY_RESULT_READY job=${request.jobId} correlation=${request.correlationId}`,
          'Do NOT approve, spend, reserve, settle or deploy funds. All spending is simulated and requires explicit human owner review in RoomTreasury.'].join('\n')
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
    let completionAuthorId: string | null = null;
    let artifacts: CollectedArtifacts | undefined;
    const seenSpecialists = new Set<string>();
    const recorded = new Set<string>();

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
          if(recorded.has(msg.id))continue;
          recorded.add(msg.id);

          if (!isRunning && (classified.isCoordinatorAck || classified.role === 'coordinator' || classified.isSpecialistProgress)) {
            isRunning = true;
            yield { key: 'discord-running', state: 'running' };
          }

          if (classified.role === 'specialist' && classified.agentName) {
            if (!seenSpecialists.has(classified.agentName)) {
              seenSpecialists.add(classified.agentName);
              yield { key: `discord-specialist-${classified.agentName}`, state: isCollecting?'collecting':'running' };
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
            completionAuthorId ??= msg.author.id;
          }
        }

        if(completionAuthorId){
          const stored=this.db.prepare("SELECT raw_json FROM discord_messages WHERE job_id=? AND author_id=? AND agent_role='coordinator' ORDER BY occurred_at,id")
            .all(jobId,completionAuthorId) as {raw_json:string}[];
          const messages=stored.map(row=>JSON.parse(row.raw_json) as DiscordMessage);
          try {
            artifacts=await this.collector.retrieveAttachmentsForJob(jobId,messages);
            break;
          } catch {
            // Completion and attachment events can arrive out of order.
            // Continue REST and Gateway collection until the configured timeout.
          }
        }

        await new Promise(resolve=>setTimeout(resolve,this.pollIntervalMs));
      }

      if(!artifacts){
        yield completionAuthorId
          ? {key:'discord-missing-attachments',state:'needs_attention',code:'discord_missing_attachments',
            diagnostic:'Missing required coordinator attachments before the collection deadline.'}
          : {key:'discord-timeout',state:'needs_attention',code:'discord_timeout'};
        return;
      }

      yield {key:'discord-validating',state:'validating'};
      // Ensure worker lease remains active during validation and ingestion
      try {
        this.db.prepare('UPDATE processing_jobs SET lease_until=? WHERE id=? AND completed_at IS NULL')
          .run(Date.now() + 120000, jobId);
      } catch {}

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
