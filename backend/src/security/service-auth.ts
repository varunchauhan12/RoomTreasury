import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Database } from 'better-sqlite3';

export const roles = ['coordinator', 'request', 'challenge', 'commitment_intelligence', 'treasury_ops'] as const;
export type Role = typeof roles[number];
export interface ServiceContext { readonly kind: 'service'; readonly principalId: string; readonly credentialId: string }
export class AuthError extends Error {
  constructor(readonly statusCode: number, readonly code: string) { super('Service request rejected.'); }
}
const deny = () => new AuthError(401, 'UNAUTHENTICATED');
const digest = (token: string) => createHash('sha256').update('RoomTreasury/service-token/v1\0').update(token).digest();
const dummy = digest('invalid');

// Returns raw material in memory only. There is no production issuance API/CLI.
export function generateCredential(): Readonly<{ id: string; token: string; secretDigest: Buffer }> {
  const id = randomBytes(16).toString('base64url');
  const token = `rt1.${id}.${randomBytes(32).toString('base64url')}`;
  return Object.freeze({ id, token, secretDigest: digest(token) });
}
function canonical(token: string): boolean {
  const parts = token.split('.');
  return /^rt1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(token) &&
    parts.slice(1).every(part => Buffer.from(part, 'base64url').toString('base64url') === part);
}
export function authenticate(db: Database, token: string, now = Date.now()): ServiceContext {
  if (!canonical(token)) throw deny();
  try {
    const row = db.prepare(`SELECT c.id,c.principal_id,c.secret_digest,c.expires_at,c.revoked_at,p.disabled_at
      FROM service_credentials c JOIN service_principals p ON p.id=c.principal_id WHERE c.id=?`)
      .get(token.split('.')[1]) as { id: string; principal_id: string; secret_digest: Buffer; expires_at: number; revoked_at: number | null; disabled_at: number | null } | undefined;
    const matches = timingSafeEqual(digest(token), row?.secret_digest ?? dummy);
    if (!row || !matches || row.revoked_at !== null || row.disabled_at !== null || row.expires_at <= now) throw deny();
    return Object.freeze({ kind: 'service', principalId: row.principal_id, credentialId: row.id });
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(503, 'SERVICE_UNAVAILABLE');
  }
}
export function bearer(rawHeaders: readonly string[]): string {
  const values: string[] = [];
  for (let i = 0; i < rawHeaders.length; i += 2) if (rawHeaders[i]?.toLowerCase() === 'authorization') values.push(rawHeaders[i + 1] ?? '');
  if (values.length !== 1 || !/^Bearer rt1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/i.test(values[0]!)) throw deny();
  return values[0]!.slice(7);
}
export function projectRole(db: Database, context: ServiceContext, projectId: string): Role {
  try {
    const scope = db.prepare('SELECT role FROM service_scopes WHERE project_id=? AND principal_id=? AND disabled_at IS NULL')
      .get(projectId, context.principalId) as { role: Role } | undefined;
    if (!scope) throw new AuthError(404, 'NOT_FOUND');
    return scope.role;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(503, 'SERVICE_UNAVAILABLE');
  }
}
export function requireRole(actual: Role, required: Role): void {
  if (actual !== required) throw new AuthError(403, 'FORBIDDEN');
}
export function denyServiceOwner(_context: ServiceContext): never { throw new AuthError(403, 'FORBIDDEN'); }
export interface AssignedTask {
  readonly projectId: string; readonly assigneeId: string; readonly role: Role;
  readonly attempt: number; readonly state: 'pending' | 'completed';
}
// Task must be loaded by trusted backend code, never taken from request JSON.
export function requireAssignedTask(context: ServiceContext, projectId: string, role: Role, task: AssignedTask, attempt: number): void {
  if (task.projectId !== projectId) throw new AuthError(404, 'NOT_FOUND');
  requireRole(role, task.role);
  if (task.assigneeId !== context.principalId) throw new AuthError(403, 'FORBIDDEN');
  if (task.attempt !== attempt || task.state !== 'pending') throw new AuthError(409, 'STALE_TASK');
}
// Future mutations must reload their trusted task inside this callback and check assignment there.
export function authorizedWrite<T>(db: Database, token: string, projectId: string, required: Role,
  write: (context: ServiceContext) => T): T {
  return db.transaction(() => {
    const context = authenticate(db, token);
    requireRole(projectRole(db, context, projectId), required);
    const result = write(context);
    if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('Authorized writes must be synchronous.');
    return result;
  }).immediate();
}
