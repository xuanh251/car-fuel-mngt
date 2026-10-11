import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Report API Integration', () => {
  async function setupAuth(app: any) {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `rep-test-${Math.random()}@example.com`, password: 'password123' },
    });
    const setCookie = reg.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return {
      sid: cookie.split(';')[0].split('=')[1],
      userId: JSON.parse(reg.body).user.id,
    };
  }

  async function createCar(app: any, { sid }: { sid: string }, data: any) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cars',
      payload: data,
      cookies: { sid },
    });
    return JSON.parse(res.body).car;
  }

  it('should reproduce the worked example', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);
    const car = await createCar(app, { sid }, { name: 'Test Car', fuelType: 'petrol', initialOdometerKm: 0 });

    const refuelings = [
      { date: '2026-01-01', odometerKm: 1000, liters: 40, totalCost: 60.00, fullTank: true },
      { date: '2026-01-10', odometerKm: 1400, liters: 20, totalCost: 30.00, fullTank: false },
      { date: '2026-01-20', odometerKm: 1600, liters: 30, totalCost: 45.00, fullTank: true },
    ];

    for (const r of refuelings) {
      await app.inject({
        method: 'POST',
        url: `/api/cars/${car.id}/refuelings`,
        payload: r,
        cookies: { sid },
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/report',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.summary.totalCost).toBe(135);
    expect(body.summary.totalLiters).toBe(90);
    expect(body.summary.refuelingCount).toBe(3);
    expect(body.summary.avgPricePerLiter).toBe(1.5);
    expect(body.summary.distanceKm).toBe(600);
    expect(body.summary.avgConsumptionLPer100Km).toBeCloseTo(8.333, 3);
    expect(body.summary.costPerKm).toBe(135 / 600);
    expect(body.monthly[0]).toEqual({
      month: '2026-01',
      liters: 90,
      cost: 135,
      refuelingCount: 3,
    });
    await app.close();
  });

  it('should return 422 if from > to', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/report?from=2026-01-02&to=2026-01-01',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error).toBe('validation_failed');
    await app.close();
  });

  it('should return 404 for non-owned car', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const user1 = await setupAuth(app);
    const user2 = await setupAuth(app);

    const car = await createCar(app, { sid: user1.sid }, { name: 'User1 Car', fuelType: 'petrol' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/report?carId=${car.id}`,
      cookies: { sid: user2.sid },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('should return 422 on carId for a repeated, non-integer, or zero value', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);

    for (const query of ['carId=1&carId=2', 'carId=abc', 'carId=0', 'carId=-1', 'carId=1.5']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/report?${query}`,
        cookies: { sid },
      });
      expect(res.statusCode, query).toBe(422);
      expect(JSON.parse(res.body).fields.carId, query).toBeDefined();
    }
    await app.close();
  });

  it('should accept carId=all and an omitted carId', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);

    for (const url of ['/api/report?carId=all', '/api/report']) {
      const res = await app.inject({ method: 'GET', url, cookies: { sid } });
      expect(res.statusCode, url).toBe(200);
    }
    await app.close();
  });
});
