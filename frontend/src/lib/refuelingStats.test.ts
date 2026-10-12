import { describe, expect, it } from 'vitest';
import type { Refueling } from '../api/types';
import { calculateRefuelingStats } from './refuelingStats';

const refueling = (overrides: Partial<Refueling> = {}): Refueling => ({
  id: 1, carId: 1, date: '2026-01-01', odometerKm: 1000, liters: 40, totalCost: 60,
  pricePerLiter: 1.5, fullTank: true, notes: null, createdAt: '', updatedAt: '', ...overrides,
});

describe('calculateRefuelingStats', () => {
  it('handles an empty list', () => {
    expect(calculateRefuelingStats([])).toEqual({ count: 0, totalLiters: 0, totalCost: 0, avgPricePerLiter: null, distanceKm: 0, avgConsumptionLPer100Km: null, costPerKm: null });
  });

  it('handles one refueling with zero distance and no consumption', () => {
    expect(calculateRefuelingStats([refueling()])).toMatchObject({ count: 1, distanceKm: 0, avgConsumptionLPer100Km: null, costPerKm: null });
  });

  it('uses max minus min distance and a weighted average price', () => {
    const stats = calculateRefuelingStats([
      refueling({ id: 1, odometerKm: 1200, liters: 20, totalCost: 60 }),
      refueling({ id: 2, odometerKm: 900, liters: 10, totalCost: 20 }),
    ]);
    expect(stats.distanceKm).toBe(300);
    expect(stats.avgPricePerLiter).toBeCloseTo(80 / 30);
  });

  it('calculates full-tank segments including pending non-full fuel and skips pre-anchor fuel', () => {
    const stats = calculateRefuelingStats([
      refueling({ id: 1, date: '2026-01-01', odometerKm: 0, liters: 5, fullTank: false }),
      refueling({ id: 2, date: '2026-01-02', odometerKm: 100, liters: 20, fullTank: true }),
      refueling({ id: 3, date: '2026-01-03', odometerKm: 150, liters: 10, fullTank: false }),
      refueling({ id: 4, date: '2026-01-04', odometerKm: 200, liters: 20, fullTank: true }),
    ]);
    expect(stats.avgConsumptionLPer100Km).toBe(30);
  });

  it('skips non-positive segment distances and does not mutate unsorted input', () => {
    const rows = [
      refueling({ id: 2, date: '2026-01-03', odometerKm: 100, liters: 20 }),
      refueling({ id: 1, date: '2026-01-01', odometerKm: 100, liters: 20 }),
    ];
    const original = [...rows];
    expect(calculateRefuelingStats(rows).avgConsumptionLPer100Km).toBeNull();
    expect(rows).toEqual(original);
  });
});
