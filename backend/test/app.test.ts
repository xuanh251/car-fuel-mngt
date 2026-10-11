import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('App Factory', () => {
  it('should create a fastify instance', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    expect(app).toBeDefined();
    await app.close();
  });
});
