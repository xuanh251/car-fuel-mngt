import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    public message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

export function errorHandler(error: any, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error.fields && { fields: error.fields }),
    });
  }

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    error.issues.forEach((issue) => {
      const path = issue.path.join('.');
      fields[path] = issue.message;
    });

    return reply.status(422).send({
      error: 'validation_failed',
      message: 'Validation failed',
      fields,
    });
  }

  // Fastify's own 4xx errors (body parsing) keep their status
  if (error.statusCode === 413) {
    return reply.status(413).send({ error: 'payload_too_large', message: 'Request body is too large' });
  }

  if (error.statusCode === 415) {
    return reply.status(415).send({ error: 'unsupported_media_type', message: 'Content-Type must be application/json' });
  }

  if (error.statusCode >= 400 && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ error: 'bad_request', message: 'Malformed JSON' });
  }

  // Default internal error
  request.log.error(error);
  return reply.status(500).send({
    error: 'internal_error',
    message: 'An unexpected error occurred',
  });
}
