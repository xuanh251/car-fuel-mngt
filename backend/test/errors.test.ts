import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Error Handling Integration', () => {
  it('should return 422 for Zod validation errors', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-an-email', password: 'short' },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('validation_failed');
    expect(body.fields).toBeDefined();
    expect(body.fields.email).toBeDefined();
    expect(body.fields.password).toBeDefined();
    await app.close();
  });

  it('should return 400 for malformed JSON', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: '{ malformed json }',
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('bad_request');
    await app.close();
  });

  it('should return 415 for wrong content type', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: 'foo=bar',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    expect(res.statusCode).toBe(415);
    expect(JSON.parse(res.body).error).toBe('unsupported_media_type');
    await app.close();
  });

  it('should accept application/json with charset parameter', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'charset@example.com', password: 'password123' },
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });

    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it('should return 404 JSON for unknown /api path', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/api/non-existent',
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe('not_found');
    await app.close();
  });

  it('should return 413 payload_too_large for a body over 1 MB', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'big@example.com', password: 'x'.repeat(1024 * 1024) },
    });

    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.body).error).toBe('payload_too_large');
    await app.close();
  });

  it('should return 400 bad_request for a non-object or empty body on every body route', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'shape@example.com', password: 'password123' },
    });
    const sid = reg.headers['set-cookie'].split(';')[0].split('=')[1];
    const json = { 'content-type': 'application/json' };

    const carRes = await app.inject({
      method: 'POST',
      url: '/api/cars',
      payload: { name: 'Shape', fuelType: 'petrol' },
      cookies: { sid },
    });
    const car = JSON.parse(carRes.body).car;
    const refRes = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-01-01', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid },
    });
    const refueling = JSON.parse(refRes.body).refueling;

    const routes = [
      { method: 'POST', url: '/api/auth/register' },
      { method: 'POST', url: '/api/auth/login' },
      { method: 'POST', url: '/api/cars' },
      { method: 'PUT', url: `/api/cars/${car.id}` },
      { method: 'POST', url: `/api/cars/${car.id}/refuelings` },
      { method: 'PUT', url: `/api/cars/${car.id}/refuelings/${refueling.id}` },
    ] as const;

    for (const route of routes) {
      for (const payload of ['[]', 'null', '"text"', '42']) {
        const res = await app.inject({ ...route, payload, headers: json, cookies: { sid } });
        expect(res.statusCode, `${route.method} ${route.url} ${payload}`).toBe(400);
        expect(JSON.parse(res.body).error).toBe('bad_request');
      }

      const empty = await app.inject({ ...route, headers: json, cookies: { sid } });
      expect(empty.statusCode, `${route.method} ${route.url} empty`).toBe(400);
      expect(JSON.parse(empty.body).error).toBe('bad_request');
    }
    await app.close();
  });

  it('should still return 400 for malformed JSON on DELETE', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'malformed-delete@example.com', password: 'password123' },
    });
    const sid = reg.headers['set-cookie'].split(';')[0].split('=')[1];

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/cars/1',
      payload: '{ malformed json }',
      headers: { 'content-type': 'application/json' },
      cookies: { sid },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('bad_request');
    await app.close();
  });
});
