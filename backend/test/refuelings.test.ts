import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Refuelings API Integration', () => {
  async function setupAuth(app: any) {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `car-fuel-${Math.random()}@example.com`, password: 'password123' },
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

  it('should create and get a refueling', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);
    const car = await createCar(app, { sid }, { name: 'Test Car', fuelType: 'petrol', initialOdometerKm: 100 });

    const refuelingData = {
      date: '2026-01-01',
      odometerKm: 500,
      liters: 40.123,
      totalCost: 60.55,
      fullTank: true,
      notes: 'First fill',
    };

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: refuelingData,
      cookies: { sid },
    });

    if (createRes.statusCode !== 201) {
      console.log('Refueling create error:', createRes.body);
    }

    expect(createRes.statusCode).toBe(201);
    const refueling = JSON.parse(createRes.body).refueling;
    expect(refueling.totalCost).toBe(60.55);
    expect(refueling.pricePerLiter).toBe(60.55 / 40.123);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/cars/${car.id}/refuelings/${refueling.id}`,
      cookies: { sid },
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    console.log('Get Refueling Body:', getBody);
    expect(getBody.refueling.odometerKm).toBe(500);
    await app.close();
  });

  it('should return 422 if odometerKm < initialOdometerKm', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);
    const car = await createCar(app, { sid }, { name: 'Test Car', fuelType: 'petrol', initialOdometerKm: 1000 });

    const res = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-01-01', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid },
    });

    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error).toBe('validation_failed');
    await app.close();
  });

  it('should return 422 for future date', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);
    const car = await createCar(app, { sid }, { name: 'Test Car', fuelType: 'petrol' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2099-01-01', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid },
    });

    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('should prevent updating car initialOdometerKm above existing refuelings', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);
    const car = await createCar(app, { sid }, { name: 'Odo Test', fuelType: 'petrol', initialOdometerKm: 100 });

    await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-01-01', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid },
    });

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/cars/${car.id}`,
      payload: { name: 'Odo Test', fuelType: 'petrol', initialOdometerKm: 600 },
      cookies: { sid },
    });

    expect(updateRes.statusCode).toBe(422);
    expect(JSON.parse(updateRes.body).error).toBe('validation_failed');
    await app.close();
  });

  it('should return 404 for refueling not owned by user', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const user1 = await setupAuth(app);
    const user2 = await setupAuth(app);

    const car = await createCar(app, { sid: user1.sid }, { name: 'User1 Car', fuelType: 'petrol' });
    const refRes = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-01-01', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid: user1.sid },
    });
    const refueling = JSON.parse(refRes.body).refueling;

    const res = await app.inject({
      method: 'GET',
      url: `/api/cars/${car.id}/refuelings/${refueling.id}`,
      cookies: { sid: user2.sid },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('should delete a refueling with JSON content type and no body, then 404 on repeat', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);
    const car = await createCar(app, { sid }, { name: 'Test Car', fuelType: 'petrol' });

    const refRes = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-01-01', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid },
    });
    const refueling = JSON.parse(refRes.body).refueling;
    const url = `/api/cars/${car.id}/refuelings/${refueling.id}`;

    const first = await app.inject({
      method: 'DELETE',
      url,
      headers: { 'content-type': 'application/json' },
      cookies: { sid },
    });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({
      method: 'DELETE',
      url,
      headers: { 'content-type': 'application/json' },
      cookies: { sid },
    });
    expect(second.statusCode).toBe(404);
    await app.close();
  });

  it('should return 404 and keep the refueling when another user deletes it', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const owner = await setupAuth(app);
    const other = await setupAuth(app);
    const car = await createCar(app, { sid: owner.sid }, { name: 'Owner Car', fuelType: 'petrol' });

    const refRes = await app.inject({
      method: 'POST',
      url: `/api/cars/${car.id}/refuelings`,
      payload: { date: '2026-01-01', odometerKm: 500, liters: 40, totalCost: 60 },
      cookies: { sid: owner.sid },
    });
    const refueling = JSON.parse(refRes.body).refueling;
    const url = `/api/cars/${car.id}/refuelings/${refueling.id}`;

    const res = await app.inject({
      method: 'DELETE',
      url,
      headers: { 'content-type': 'application/json' },
      cookies: { sid: other.sid },
    });
    expect(res.statusCode).toBe(404);

    const still = await app.inject({ method: 'GET', url, cookies: { sid: owner.sid } });
    expect(still.statusCode).toBe(200);
    await app.close();
  });

  it('should reject liters and totalCost given in exponent form with too many decimals', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();
    const { sid } = await setupAuth(app);
    const car = await createCar(app, { sid }, { name: 'Exp Car', fuelType: 'petrol' });
    const post = (overrides: object) =>
      app.inject({
        method: 'POST',
        url: `/api/cars/${car.id}/refuelings`,
        payload: { date: '2026-01-01', odometerKm: 500, liters: 40, totalCost: 60, ...overrides },
        cookies: { sid },
      });

    const litersRes = await post({ liters: 1e-7 });
    expect(litersRes.statusCode).toBe(422);
    expect(JSON.parse(litersRes.body).fields.liters).toBeDefined();

    const costRes = await post({ totalCost: 1e-7 });
    expect(costRes.statusCode).toBe(422);
    expect(JSON.parse(costRes.body).fields.totalCost).toBeDefined();

    const validRes = await post({ liters: 40.123, totalCost: 60.55 });
    expect(validRes.statusCode).toBe(201);
    await app.close();
  });
});
