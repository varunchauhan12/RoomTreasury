import {registerProjectImports} from './imports/project-routes.js';
import {registerProjectWorkspace} from './web/project-workspace.js';
import { registerJobs } from './jobs/routes.js';
import { registerLoginPage } from './security/owner-login-page.js';
import { authSettings } from './security/owner-auth.js';
import { registerOwnerAuth } from './security/owner-routes.js';
import { registerReview } from './reviews/routes.js';
import { registerReviewWidget } from './reviews/widget.js';
import { registerImports } from './imports/routes.js';
import { registerImportWorkspace } from './imports/workspace.js';
import { registerEstimation } from './api/estimation.js';
import { registerClientProjects } from './api/client-projects.js';
import { registerDashboard } from './web/dashboard.js';
import { registerIdentity } from './security/identity-route.js';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import type { Database } from 'better-sqlite3';
import { errorSchema, installErrorHandling } from './api/errors.js';

export async function buildApp(db: Database, options: {aiFetch?:typeof fetch} = {}) {
  const app = Fastify({
    logger: false, // Never automatically log request bodies, headers or raw exceptions.
    genReqId: () => randomUUID(), requestIdHeader: false,
    exposeHeadRoutes: false, bodyLimit: 16384,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } }
  });
  installErrorHandling(app);
  const ownerSettings=authSettings(db);
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3', info: { title: 'RoomTreasury foundation', version: '0.1.0' },
      components: {
        securitySchemes: { serviceBearer: { type: 'http', scheme: 'bearer' }, ownerCookie: {type:'apiKey',in:'cookie',name:ownerSettings.cookieName} },
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
  registerClientProjects(app, db,ownerSettings);
  registerEstimation(app,db,options.aiFetch);
  registerDashboard(app);
  registerProjectWorkspace(app);
  registerImports(app,db,ownerSettings);
  registerProjectImports(app,db,ownerSettings);
  registerImportWorkspace(app);
  registerOwnerAuth(app,db,ownerSettings);
  registerLoginPage(app);
  registerReview(app,db,ownerSettings);
  registerReviewWidget(app);
  registerJobs(app,db,ownerSettings);
  app.addHook('onClose', async () => { if (db.open) db.close(); });
  return app;
}
