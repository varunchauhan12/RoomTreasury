import { ImportError } from '../imports/service.js';
import { EstimateError } from '../ai/estimate.js';
import { AuthError } from '../security/service-auth.js';
import type { FastifyInstance } from 'fastify';

export const errorSchema = {
  type: 'object' as const, additionalProperties: false, required: ['error'],
  properties: {
    error: {
      type: 'object' as const, additionalProperties: false,
      required: ['code', 'message', 'details', 'correlationId'],
      properties: {
        code: { type: 'string' as const }, message: { type: 'string' as const },
        details: { type: 'object' as const, additionalProperties: false }, correlationId: { type: 'string' as const }
      }
    }
  }
};
export function installErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if(error instanceof EstimateError) return reply.code(error.statusCode).send({error:{code:error.code,message:error.message,details:{},correlationId:request.id}});
    if(error instanceof ImportError)return reply.code(error.statusCode).send({error:{code:'PROPOSAL_IMPORT_REJECTED',message:error.issues.join(' '),details:{},correlationId:request.id}});
    const known = error as { validation?: unknown; statusCode?: number; message?: string };
    const status = known.validation ? 400 : known.statusCode && known.statusCode >= 400 && known.statusCode <= 503 ? known.statusCode : 500;
    const code = error instanceof AuthError ? error.code : status === 400 ? 'INVALID_REQUEST' : status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 415 ? 'UNSUPPORTED_MEDIA_TYPE' : status < 500 ? 'REQUEST_REJECTED' : 'INTERNAL_ERROR';
    const message = known.validation ? (typeof known.message === 'string' && known.message ? known.message : 'Request validation failed.') : status < 500 ? 'Request rejected.' : 'An internal error occurred.';
    reply.code(status).send({ error: { code, message, details: {}, correlationId: request.id } });
  });
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found.', details: {}, correlationId: request.id } });
  });
}
