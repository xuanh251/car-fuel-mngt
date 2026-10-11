import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './client';
import type { ApiError } from './types';

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('successfully fetches data', async () => {
    const mockData = { cars: [] };
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await api.cars.list();
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith('/api/cars', expect.any(Object));
  });

  it('handles 204 No Content', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await api.auth.logout();
    expect(result).toEqual({});
  });

  it('handles API errors', async () => {
    const errorBody = {
      error: 'validation_failed',
      message: 'Invalid input',
      fields: { email: 'Invalid email address' },
    };
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => errorBody,
    });

    try {
      await api.auth.register({ email: 'invalid', password: 'password' });
    } catch (e) {
      const error = e as ApiError;
      expect(error).toEqual({
        status: 422,
        code: 'validation_failed',
        message: 'Invalid input',
        fields: { email: 'Invalid email address' },
      });
    }
  });

  it('handles non-JSON errors', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('Not JSON'); },
    });

    try {
      await api.auth.me();
    } catch (e) {
      const error = e as ApiError;
      expect(error.code).toBe('unknown_error');
      expect(error.status).toBe(500);
    }
  });

  it('correctly builds report query string', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ summary: {}, monthly: [] }),
    });

    await api.report({ carId: 'all', from: '2026-01-01', to: '2026-01-31' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/report?carId=all&from=2026-01-01&to=2026-01-31',
      expect.any(Object)
    );
  });

  it('car get unwraps {car}', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ car: { id: 1, name: 'X' } }),
    });
    const car = await api.cars.get(1);
    expect(car).toEqual({ id: 1, name: 'X' });
  });

  it('car create unwraps {car}', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ car: { id: 2, name: 'Y' } }),
    });
    const created = await api.cars.create({ name: 'Y', fuelType: 'petrol' });
    expect(created).toEqual({ id: 2, name: 'Y' });
  });

  it('car update unwraps {car}', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ car: { id: 1, name: 'Z' } }),
    });
    const updated = await api.cars.update(1, { name: 'Z', fuelType: 'petrol' });
    expect(updated).toEqual({ id: 1, name: 'Z' });
  });

  it('refueling get unwraps {refueling}', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ refueling: { id: 5, liters: 40 } }),
    });
    const r = await api.refuelings.get(1, 5);
    expect(r).toEqual({ id: 5, liters: 40 });
  });

  it('refueling create unwraps {refueling}', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ refueling: { id: 6, liters: 30 } }),
    });
    const added = await api.refuelings.create(1, { date: '2026-01-01', odometerKm: 1000, liters: 30, totalCost: 48 });
    expect(added).toEqual({ id: 6, liters: 30 });
    expect(fetch).toHaveBeenCalledWith('/api/cars/1/refuelings', expect.any(Object));
  });

  it('refueling update unwraps {refueling}', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ refueling: { id: 5, liters: 41 } }),
    });
    const updated = await api.refuelings.update(1, 5, { date: '2026-01-01', odometerKm: 1000, liters: 41, totalCost: 49 });
    expect(updated).toEqual({ id: 5, liters: 41 });
  });

  it('sends no Content-Type on DELETE or logout without a body', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 204 });

    await api.cars.delete(1);
    await api.auth.logout();

    for (const [, init] of (fetch as any).mock.calls) {
      expect(new Headers(init.headers).has('Content-Type')).toBe(false);
    }
  });

  it('sends Content-Type application/json with a body', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ car: { id: 3 } }) });

    await api.cars.create({ name: 'Z', fuelType: 'petrol' });

    const [, init] = (fetch as any).mock.calls[0];
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });
});
