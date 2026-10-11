import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { initDb } from './db/index.js';
import { authRoutes } from './auth/routes.js';
import { errorHandler } from './errors.js';
import { carRoutes } from './cars/routes.js';
import { refuelingRoutes } from './refuelings/routes.js';
import { reportRoutes } from './report/routes.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../');

export interface AppOptions {
  databasePath: string;
  now?: () => Date;
  staticPath?: string;
}

export function buildApp(options: AppOptions) {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'development' ? { level: 'info' } : { level: 'error' },
  });

  app.register(fastifyCookie);

  const staticPath = options.staticPath || path.resolve(REPO_ROOT, 'frontend/dist');
  app.register(fastifyStatic, {
    root: staticPath,
    wildcard: false,
  });

  const db = initDb(options);
  app.decorate('db', db);
  app.decorate('now', options.now || (() => new Date()));

  app.setErrorHandler(errorHandler);

  // The client sends Content-Type: application/json on every request, so DELETE and logout
  // arrive with an empty JSON body. Fastify rejects that with FST_ERR_CTP_EMPTY_JSON_BODY.
  // Treat an empty body as no body; keep Fastify's JSON parser for everything else.
  const defaultJsonParser = app.getDefaultJsonParser('error', 'error');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser<string>('application/json', { parseAs: 'string' }, (request, body, done) => {
    if (body.trim() === '') {
      done(null, undefined);
      return;
    }
    defaultJsonParser(request, body, done);
  });

  app.addHook('preHandler', async (request, reply) => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (!request.body) {
        // Allow empty body for POST (e.g. logout)
        if (request.method === 'POST') return;
      }
      const contentType = request.headers['content-type'] || '';
      const mediaType = contentType.split(';')[0].trim().toLowerCase();
      if (mediaType !== 'application/json') {
        return reply.status(415).send({
          error: 'unsupported_media_type',
          message: 'Body must be application/json',
        });
      }
    }
  });

  app.register(authRoutes, { prefix: '/api' });
  app.register(carRoutes, { prefix: '/api/cars' });
  app.register(refuelingRoutes, { prefix: '/api/cars' });
  app.register(reportRoutes, { prefix: '/api' });

  // API 404 handler and SPA fallback
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'The requested API endpoint was not found',
      });
    }
    
    // For non-API paths, try to serve index.html if it exists
    if (fs.existsSync(path.join(staticPath, 'index.html'))) {
      return reply.sendFile('index.html');
    }

    reply.status(404).send('Not Found');
  });

  return app;
}
