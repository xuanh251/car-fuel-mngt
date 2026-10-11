import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Security Regression Tests', () => {
  async function setupUser(app: any, email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'password123' },
    });
    const cookie = res.headers['set-cookie'];
    const sid = Array.isArray(cookie) ? cookie[0].split(';')[0].split('=')[1] : cookie.split(';')[0].split('=')[1];
    return { sid, userId: JSON.parse(res.body).user.id };
  }

  it('should return 401 for protected routes without cookie', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const routes = [
      '/api/cars',
      '/api/report',
    ];

    for (const route of routes) {
      const res = await app.inject({ method: 'GET', url: route });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe('unauthorized');
    }
    await app.close();
  });

  it('should return 404 for cross-user access', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const u1 = await setupUser(app, 'u1@example.com');
    const u2 = await setupUser(app, 'u2@example.com');

    const carRes = await app.inject({
      method: 'POST',
      url: '/api/cars',
      payload: { name: 'U1 Car', fuelType: 'petrol' },
      cookies: { sid: u1.sid },
    });
    const car = JSON.parse(carRes.body).car;

    const refRes = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-01-01', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid: u1.sid },
    });
    const ref = JSON.parse(refRes.body).refueling;

    // User 2 tries to access User 1's resources
    const getCarRes = await app.inject({
      method: 'GET',
      url: `/api/cars/${car.id}`,
      cookies: { sid: u2.sid },
    });
    expect(getCarRes.statusCode).toBe(404);

    const getRefRes = await app.inject({
      method: 'GET',
      url: `/api/cars/${car.id}/refuelings/${ref.id}`,
      cookies: { sid: u2.sid },
    });
    expect(getRefRes.statusCode).toBe(404);

    const getRefListRes = await app.inject({
      method: 'GET',
      url: `/api/cars/${car.id}/refuelings`,
      cookies: { sid: u2.sid },
    });
    expect(getRefListRes.statusCode).toBe(404);

    const reportRes = await app.inject({
      method: 'GET',
      url: `/api/report?carId=${car.id}`,
      cookies: { sid: u2.sid },
    });
    expect(reportRes.statusCode).toBe(404);

    await app.close();
  });

  it('should never return sensitive data in response bodies', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupUser(app, 'sec@example.com');

    const endpoints = [
      { method: 'POST', url: '/api/auth/register', payload: { email: 'sec2@example.com', password: 'password123' } },
      { method: 'POST', url: '/api/auth/login', payload: { email: 'sec@example.com', password: 'password123' } },
      { method: 'GET', url: '/api/auth/me', cookies: { sid } },
      { method: 'POST', url: '/api/cars', payload: { name: 'Sec Car', fuelType: 'petrol' }, cookies: { sid } },
    ];

    for (const { method, url, payload, cookies } of endpoints) {
      const res = await app.inject({ method, url, payload, cookies });
      const body = res.body;
      expect(body).not.toContain('password_hash');
      expect(body).not.toContain('password');
      // We only check for token-like strings in body, not headers
      if (body.includes('sid')) {
        // sid in cookies is fine, but not in body
        expect(body).not.toMatch(/sid=[a-zA-Z0-9_-]{32,}/);
      }
    }
    await app.close();
  });

  it('should return 401 before body parsing when there is no session', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const json = { 'content-type': 'application/json' };
    const textPlain = { 'content-type': 'text/plain' };

    const cases = [
      { method: 'POST', url: '/api/cars', payload: '{ malformed', headers: json },
      { method: 'POST', url: '/api/cars', payload: 'name=test', headers: textPlain },
      { method: 'PUT', url: '/api/cars/1', payload: '{ malformed', headers: json },
      { method: 'POST', url: '/api/cars/1/refuelings', payload: 'name=test', headers: textPlain },
      { method: 'PUT', url: '/api/cars/1/refuelings/1', payload: '{ malformed', headers: json },
      { method: 'DELETE', url: '/api/cars/1', headers: json },
    ] as const;

    for (const testCase of cases) {
      const res = await app.inject(testCase);
      expect(res.statusCode, `${testCase.method} ${testCase.url}`).toBe(401);
      expect(JSON.parse(res.body).error).toBe('unauthorized');
    }
    await app.close();
  });
});
