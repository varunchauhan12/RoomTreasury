import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from 'better-sqlite3';
import { errorSchema } from '../api/errors.js';
import { authenticate, bearer, projectRole, roles, AuthError, type ServiceContext } from './service-auth.js';

export function registerIdentity(app: FastifyInstance, db: Database): void {
  const contexts = new WeakMap<FastifyRequest, ServiceContext>();
  app.get<{ Params: { projectId: string } }>('/v1/projects/:projectId/service-identity', {
    onRequest: async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      contexts.set(request, authenticate(db, bearer(request.raw.rawHeaders)));
      if (request.headers['transfer-encoding'] || (request.headers['content-length'] && request.headers['content-length'] !== '0')) {
        throw new AuthError(400, 'INVALID_REQUEST');
      }
    },
    schema: {
      operationId: 'getServiceIdentity', summary: 'Read authenticated service identity in one project',
      security: [{ serviceBearer: [] }],
      params: { type: 'object', required: ['projectId'], additionalProperties: false,
        properties: { projectId: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9_-]+$' } } },
      querystring: { type: 'object', properties: {}, additionalProperties: false },
      response: {
        200: { type: 'object', additionalProperties: false, required: ['principalId', 'kind', 'projectId', 'role'], properties: {
          principalId: { type: 'string' }, kind: { type: 'string', enum: ['service'] },
          projectId: { type: 'string' }, role: { type: 'string', enum: [...roles] }
        } },
        400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 503: errorSchema
      }
    }
  }, (request) => {
    const context = contexts.get(request);
    if (!context) throw new AuthError(401, 'UNAUTHENTICATED');
    return { principalId: context.principalId, kind: context.kind, projectId: request.params.projectId,
      role: projectRole(db, context, request.params.projectId) };
  });
}
