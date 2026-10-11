import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Fixes Verification', () => {
  async function setupAuth(app: any, email: string) {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'password123' },
    });
    const setCookie = reg.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return {
      sid: cookie.split(';')[0].split('=')[1],
      userId: JSON.parse(reg.body).user.id,
    };
  }

  it('Fix 1: login with unknown email -> 401', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'unknown@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe('invalid_credentials');
    await app.close();
  });

  it('Fix 2: car responses match contract keys', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app, 'car-dto@example.com');
    const carData = { name: 'Tesla', fuelType: 'electric' };
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/cars',
      payload: carData,
      cookies: { sid },
    });
    const car = JSON.parse(createRes.body).car;
    expect(car).toHaveProperty('fuelType');
    expect(car).not.toHaveProperty('fuel_type');
    expect(car).not.toHaveProperty('user_id');
    await app.close();
  });

  it('Fix 4: refueling date rollover 2026-02-31 -> 422', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app, 'date-test@example.com');
    const carRes = await app.inject({
      method: 'POST',
      url: '/api/cars',
      payload: { name: 'Test', fuelType: 'petrol' },
      cookies: { sid },
    });
    const car = JSON.parse(carRes.body).car;
    const res = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-02-31', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('Fix 6: report garbage dates -> 422', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app, 'rep-date@example.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/report?from=garbage',
      cookies: { sid },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('Fix 7: cars PUT ownership check first', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const u1 = await setupAuth(app, 'u1@example.com');
    const u2 = await setupAuth(app, 'u2@example.com');
    const carRes = await app.inject({
      method: 'POST',
      url: '/api/cars',
      payload: { name: 'U1 Car', fuelType: 'petrol' },
      cookies: { sid: u1.sid },
    });
    const car = JSON.parse(carRes.body).car;
    const res = await app.inject({
      method: 'PUT',
      url: `/api/cars/${car.id}`,
      payload: { name: 'Invalid', fuelType: 'wrong' }, // Invalid fuelType
      cookies: { sid: u2.sid },
    });
    expect(res.statusCode).toBe(404); // Should return 404 because User 2 doesn't own it, before 422 for invalid fuelType
    await app.close();
  });

  it('Fix 8: non-JSON body -> 415', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: 'name=test',
      headers: { 'content-type': 'text/plain' },
    });
    expect(res.statusCode).toBe(415);
    await app.close();
  });

  it('Fix 10: email trim before validation', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: '  test@example.com  ', password: 'password123' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });
});
