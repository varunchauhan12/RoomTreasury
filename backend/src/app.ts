import { registerIdentity } from './security/identity-route.js';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import type { Database } from 'better-sqlite3';
import { errorSchema, installErrorHandling } from './api/errors.js';

export async function buildApp(db: Database) {
  const app = Fastify({
    logger: false, // Never automatically log request bodies, headers or raw exceptions.
    genReqId: () => randomUUID(), requestIdHeader: false,
    exposeHeadRoutes: false, bodyLimit: 16384,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } }
  });
  installErrorHandling(app);
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3', info: { title: 'RoomTreasury foundation', version: '0.1.0' },
      components: {
        securitySchemes: { serviceBearer: { type: 'http', scheme: 'bearer' } },
        responses: { NotFound: { description: 'Unknown routes return HTTP 404 with this envelope.', content: { 'application/json': { schema: errorSchema } } } }
      }
    }
  });
  app.get('/health', {
    schema: {
      operationId: 'getHealth', summary: 'Check service and SQLite readiness',
      querystring: { type: 'object', properties: {}, additionalProperties: false },
      response: {
        200: {
          type: 'object', additionalProperties: false, required: ['status'],
          properties: { status: { type: 'string', enum: ['ok'] } }
        },
        400: errorSchema, 500: errorSchema, 503: errorSchema
      }
    }
  }, (request, reply) => {
    try { db.prepare('SELECT 1').get(); }
    catch {
      return reply.code(503).send({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Service unavailable.', details: {}, correlationId: request.id } });
    }
    return { status: 'ok' };
  });
  registerIdentity(app, db);
  app.addHook('onClose', async () => { if (db.open) db.close(); });
  return app;
}
