import { FastifyRequest, FastifyReply } from 'fastify';
import { getSessionUserId } from './sessions.js';

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies.sid;
  if (!token) {
    return reply.status(401).send({
      error: 'unauthorized',
      message: 'Authentication required',
    });
  }

  const userId = getSessionUserId(request.server.db, token);
  if (!userId) {
    return reply.status(401).send({
      error: 'unauthorized',
      message: 'Invalid or expired session',
    });
  }

  // Attach userId to request for later use
  (request as any).userId = userId;
}
