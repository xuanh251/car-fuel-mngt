import { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';

export async function registerStatic(fastify: FastifyInstance, options: { staticPath?: string }) {
  const resolvedPath = options.staticPath || path.resolve('frontend/dist');
  
  if (!fs.existsSync(resolvedPath)) {
    fastify.log.warn('static directory not found, static files will not be served');
    return;
  }

  fastify.register(fastifyStatic, {
    root: resolvedPath,
    wildcard: false,
  });
}
