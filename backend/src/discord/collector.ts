import type { Database } from 'better-sqlite3';
import type { DiscordConfig } from './config.js';
import type { DiscordMessage, DiscordRestClient, FetchedAttachment } from './client.js';

export type AgentRole = 'coordinator' | 'specialist' | 'bot' | 'other';

export interface ClassifiedMessage {
  message: DiscordMessage;
  jobId: string;
  role: AgentRole;
  agentName: string | null;
  isCoordinatorAck: boolean;
  isSpecialistProgress: boolean;
  isCompletionMarker: boolean;
}

export interface CollectedArtifacts {
  proposal: FetchedAttachment;
  evidence: FetchedAttachment;
  summary: FetchedAttachment;
}

const SPECIALIST_NAMES = new Set([
  'req-agent',
  'challenge-agent',
  'commitment-intelligence-agent',
  'treasury-ops-agent',
]);

const SPECIALIST_DISPLAY_NAMES: Record<string, string> = {
  'request agent': 'req-agent',
  'challenge agent': 'challenge-agent',
  'commitment intelligence agent': 'commitment-intelligence-agent',
  'treasury operations agent': 'treasury-ops-agent',
};

export function classifySender(authorUsername: string, isBot: boolean): { role: AgentRole; agentName: string | null } {
  const normalized = authorUsername.toLowerCase().trim();
  if (normalized.includes('make-proposal-agent') || normalized === 'make proposal agent' || normalized === 'coordinator') {
    return { role: 'coordinator', agentName: 'make-proposal-agent' };
  }
  for (const name of SPECIALIST_NAMES) {
    if (normalized === name || normalized.includes(name)) {
      return { role: 'specialist', agentName: name };
    }
  }
  for (const [display, canonical] of Object.entries(SPECIALIST_DISPLAY_NAMES)) {
    if (normalized === display || normalized.includes(display)) {
      return { role: 'specialist', agentName: canonical };
    }
  }
  return { role: isBot ? 'bot' : 'other', agentName: null };
}

export class DiscordMessageCollector {
  private readonly verifiedFiles = new Map<string,FetchedAttachment>();
  constructor(
    private readonly db: Database,
    private readonly config: DiscordConfig,
    private readonly client: DiscordRestClient
  ) {}

  filterMessage(message: DiscordMessage): boolean {
    if (message.channel_id !== this.config.channelId) return false;
    if (message.guild_id && message.guild_id !== this.config.guildId) return false;
    return true;
  }

  isCorrelated(message: DiscordMessage, jobId: string, correlationId: string, taskId?: string): boolean {
    const text = message.content;
    if (text.includes(jobId) || text.includes(correlationId)) return true;
    if (taskId && text.includes(taskId)) return true;
    return false;
  }

  async correlateMessage(message: DiscordMessage, jobId: string, correlationId: string, taskId?: string): Promise<boolean> {
    if (!this.filterMessage(message)) return false;
    if (this.isCorrelated(message,jobId,correlationId,taskId)) return true;
    if (classifySender(message.author.username,!!message.author.bot).role !== 'coordinator' || !message.attachments.length) return false;
    const job = this.db.prepare('SELECT intake_snapshot,intake_hash,intake_revision,correlation_id FROM processing_jobs WHERE id=?').get(jobId) as {intake_snapshot:string;intake_hash:string;intake_revision:number;correlation_id:string}|undefined;
    if (!job || job.correlation_id !== correlationId) return false;
    const intake = JSON.parse(job.intake_snapshot);
    if (taskId && intake.taskId !== taskId) return false;
    let matched = false;
    for (const attachment of message.attachments) {
      const name = attachment.filename.toLowerCase();
      let limit = 0;
      let isSummary = false;
      if (name === 'proposal.json' || name.endsWith('proposal.json')) limit = 262144;
      else if (name === 'evidence.json' || name.endsWith('evidence.json') || name.endsWith('specialist-evidence.json')) limit = 524288;
      else if (name === 'summary.md' || name.endsWith('summary.md')) { limit = 65536; isSummary = true; }
      if (!limit) continue;
      try {
        const file = this.verifiedFiles.get(attachment.id) ?? await this.client.fetchAttachment(attachment, limit);
        if (isSummary) {
          if (![intake.projectId, intake.taskId, jobId, correlationId, job.intake_hash].every(value => file.contentText.includes(value))
            || !new RegExp('(?:intake\\s+)?revision\\s*[:=]?\\s*`?' + job.intake_revision + '\\b', 'i').test(file.contentText)) continue;
        } else {
          const data = JSON.parse(file.contentText);
          if (data.projectId !== intake.projectId || data.taskId !== intake.taskId ||
              data.processingJobId !== jobId || data.correlationId !== correlationId ||
              data.intakeRevision !== job.intake_revision || data.intakeSha256 !== job.intake_hash) continue;
        }
        this.verifiedFiles.set(attachment.id, file);
        matched = true;
      } catch { /* Unverified files are never attached to a job by proximity or filename. */ }
    }
    return matched;
  }

  recordMessage(message: DiscordMessage, jobId: string): ClassifiedMessage | null {
    if (!this.filterMessage(message)) return null;

    const isBot = !!message.author.bot;
    const { role, agentName } = classifySender(message.author.username, isBot);
    const content = message.content;
    const occurredAt = new Date(message.timestamp).getTime() || Date.now();
    const recordedAt = Date.now();

    // Check completion marker: ROOMTREASURY_RESULT_READY job={job_id} correlation={correlation_id}
    const boundJob=this.db.prepare('SELECT correlation_id FROM processing_jobs WHERE id=?').get(jobId) as {correlation_id:string}|undefined;
    const hasCompletionMarker = role==='coordinator' && /ROOMTREASURY_RESULT_READY\b/.test(content) && content.includes('job='+jobId) && !!boundJob && content.includes('correlation='+boundJob.correlation_id);
    const isCoordinatorAck = role === 'coordinator' && !hasCompletionMarker && (
      /\b(ack|acknowledged|started|starting|received|working)\b/i.test(content) || content.includes(jobId)
    );
    const isSpecialistProgress = role === 'specialist' && !hasCompletionMarker;

    // Idempotent recording into discord_messages
    const existing = this.db.prepare('SELECT id,job_id FROM discord_messages WHERE id=?').get(message.id) as {id:string;job_id:string}|undefined;
    if(existing&&existing.job_id!==jobId)return null;
    if (!existing) {
      this.db.prepare(`
        INSERT INTO discord_messages(id, job_id, channel_id, author_id, author_username, is_bot, agent_role, agent_name, content, raw_json, occurred_at, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        message.id,
        jobId,
        message.channel_id,
        message.author.id,
        message.author.username,
        isBot ? 1 : 0,
        role,
        agentName,
        content,
        JSON.stringify(message),
        occurredAt,
        recordedAt
      );
    }

    return {
      message,
      jobId,
      role,
      agentName,
      isCoordinatorAck,
      isSpecialistProgress,
      isCompletionMarker: hasCompletionMarker,
    };
  }

  getObservedSpecialists(jobId: string): Set<string> {
    const rows = this.db.prepare(
      "SELECT DISTINCT agent_name FROM discord_messages WHERE job_id=? AND agent_role='specialist' AND agent_name IS NOT NULL"
    ).all(jobId) as { agent_name: string }[];
    return new Set(rows.map((r) => r.agent_name));
  }

  updateCheckpoint(channelId: string, lastMessageId: string, sequence?: number | null): void {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO discord_checkpoints(channel_id, last_message_id, last_sequence, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(channel_id) DO UPDATE SET
        last_message_id=excluded.last_message_id,
        last_sequence=coalesce(excluded.last_sequence, discord_checkpoints.last_sequence),
        updated_at=excluded.updated_at
    `).run(channelId, lastMessageId, sequence ?? null, now);
  }

  getCheckpoint(channelId: string): { lastMessageId: string; lastSequence: number | null } | null {
    const row = this.db.prepare('SELECT last_message_id, last_sequence FROM discord_checkpoints WHERE channel_id=?').get(channelId) as { last_message_id: string; last_sequence: number | null } | undefined;
    if (!row) return null;
    return { lastMessageId: row.last_message_id, lastSequence: row.last_sequence };
  }

  async backfillHistory(jobId: string, correlationId: string, taskId?: string): Promise<ClassifiedMessage[]> {
    const checkpoint = this.getCheckpoint(this.config.channelId);
    const messages = await this.client.getMessages(this.config.channelId, {
      after: checkpoint?.lastMessageId,
      limit: 50,
    });

    const results: ClassifiedMessage[] = [];
    // Process messages in chronological order (Discord returns newest first)
    const sorted = [...messages].sort((a, b) => (a.id < b.id ? -1 : 1));

    for (const msg of sorted) {
      if (await this.correlateMessage(msg, jobId, correlationId, taskId)) {
        const classified = this.recordMessage(msg, jobId);
        if (classified) results.push(classified);
      }
      this.updateCheckpoint(this.config.channelId, msg.id);
    }

    return results;
  }

  async retrieveAttachmentsForJob(jobId: string, messagesWithAttachments: DiscordMessage[]): Promise<CollectedArtifacts> {
    const job = this.db.prepare('SELECT correlation_id,intake_snapshot FROM processing_jobs WHERE id=?')
      .get(jobId) as {correlation_id:string;intake_snapshot:string}|undefined;
    if (!job) throw new Error('Processing job does not exist.');
    const correlationId = job.correlation_id;
    const {taskId} = JSON.parse(job.intake_snapshot);
    // File-only messages enter the package only if each file was bound by its contents.
    const allAttachments = messagesWithAttachments
      .filter(m => this.filterMessage(m) && classifySender(m.author.username, !!m.author.bot).role === 'coordinator')
      .flatMap(m => m.attachments
        .filter(attachment => this.isCorrelated(m,jobId,correlationId,taskId) || this.verifiedFiles.has(attachment.id))
        .map(attachment => ({ attachment, messageId: m.id })));

    let proposalMeta: { attachment: typeof allAttachments[0]['attachment']; messageId: string } | null = null;
    let evidenceMeta: { attachment: typeof allAttachments[0]['attachment']; messageId: string } | null = null;
    let summaryMeta: { attachment: typeof allAttachments[0]['attachment']; messageId: string } | null = null;

    for (const item of allAttachments) {
      const name = item.attachment.filename.toLowerCase();
      if (name === 'proposal.json' || name.endsWith('proposal.json')) {
        proposalMeta = item;
      } else if (name === 'evidence.json' || name.endsWith('evidence.json') || name.endsWith('specialist-evidence.json')) {
        evidenceMeta = item;
      } else if (name === 'summary.md' || name.endsWith('summary.md')) {
        summaryMeta = item;
      }
    }

    if (!proposalMeta || !evidenceMeta || !summaryMeta) {
      const missing: string[] = [];
      if (!proposalMeta) missing.push('proposal.json');
      if (!evidenceMeta) missing.push('evidence.json');
      if (!summaryMeta) missing.push('summary.md');
      throw new Error(`Missing required coordinator attachments: ${missing.join(', ')}.`);
    }

    // Download attachments within their strict size limits:
    // proposal <= 256 KiB, evidence <= 512 KiB, summary <= 64 KiB
    const download = async (meta: typeof allAttachments[number], limit: number) => {
      const cached = this.verifiedFiles.get(meta.attachment.id);
      if (cached) return cached;
      const file = await this.client.fetchAttachment(meta.attachment, limit);
      this.verifiedFiles.set(file.id, file);
      return file;
    };
    const proposal = await download(proposalMeta, 256 * 1024);
    const evidence = await download(evidenceMeta, 512 * 1024);
    const summary = await download(summaryMeta, 64 * 1024);

    const now = Date.now();
    for (const [meta, fetched] of [
      [proposalMeta, proposal],
      [evidenceMeta, evidence],
      [summaryMeta, summary],
    ] as const) {
      const existing = this.db.prepare('SELECT id FROM discord_attachments WHERE id=?').get(fetched.id);
      if (!existing) {
        this.db.prepare(`
          INSERT INTO discord_attachments(id, message_id, job_id, filename, byte_size, sha256, content_text, discord_url, retrieved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          fetched.id,
          meta.messageId,
          jobId,
          fetched.filename,
          fetched.byteSize,
          fetched.sha256,
          fetched.contentText,
          fetched.url,
          now
        );
      }
    }

    return { proposal, evidence, summary };
  }
}

