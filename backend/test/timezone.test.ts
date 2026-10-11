import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Timezone Date Validation', () => {
  async function setupAuth(app: any) {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `tz-${Math.random()}@example.com`, password: 'password123' },
    });
    const cookie = reg.headers['set-cookie'];
    const sid = Array.isArray(cookie) ? cookie[0].split(';')[0].split('=')[1] : cookie.split(';')[0].split('=')[1];
    return { sid };
  }

  it('should accept today local date and reject tomorrow local date in Asia/Bangkok', async () => {
    // We simulate the clock using buildApp options
    // TZ=Asia/Bangkok, now = 2026-10-11T17:30:00Z (Local = 2026-10-12 00:30)
    const mockNow = () => new Date('2026-10-11T17:30:00Z');
    
    // We need to be careful: the code uses local date methods (getFullYear etc)
    // which depend on the process.env.TZ.
    process.env.TZ = 'Asia/Bangkok';
    
    const app = buildApp({ 
      databasePath: ':memory:',
      now: mockNow,
    });
    await app.ready();
    const { sid } = await setupAuth(app);
    const carRes = await app.inject({
      method: 'POST',
      url: '/api/cars',
      payload: { name: 'TZ Car', fuelType: 'petrol' },
      cookies: { sid },
    });
    const car = JSON.parse(carRes.body).car;

    // 2026-10-12 is today in Bangkok
    const resToday = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-10-12', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid },
    });
    expect(resToday.statusCode).toBe(201);

    // 2026-10-13 is tomorrow in Bangkok
    const resTomorrow = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-10-13', odometerKm: 600, liters: 40, totalCost: 60 },
      cookies: { sid },
    });
    expect(resTomorrow.statusCode).toBe(422);

    await app.close();
    delete process.env.TZ;
  });
});
