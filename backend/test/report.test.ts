import { describe, it, expect } from 'vitest';
import { calculateReport, Refueling } from '../src/report/calc.js';

describe('Report Calculations', () => {
  it('should match the worked example', () => {
    const carId = 1;
    const refuelings: Refueling[] = [
      { id: 1, carId, date: '2026-01-01', odometerKm: 1000, liters: 40, totalCost: 60.00, fullTank: true },
      { id: 2, carId, date: '2026-01-10', odometerKm: 1400, liters: 20, totalCost: 30.00, fullTank: false },
      { id: 3, carId, date: '2026-01-20', odometerKm: 1600, liters: 30, totalCost: 45.00, fullTank: true },
    ];
    const data = new Map([[carId, refuelings]]);
    const report = calculateReport(data);

    expect(report.summary.totalCost).toBe(135);
    expect(report.summary.totalLiters).toBe(90);
    expect(report.summary.refuelingCount).toBe(3);
    expect(report.summary.avgPricePerLiter).toBe(1.5);
    expect(report.summary.distanceKm).toBe(600);
    expect(report.summary.avgConsumptionLPer100Km).toBeCloseTo(8.333, 3);
    expect(report.summary.costPerKm).toBe(135 / 600);
    expect(report.monthly[0]).toEqual({
      month: '2026-01',
      liters: 90,
      cost: 135,
      refuelingCount: 3,
    });
  });

  it('should handle all-cars distance correctly', () => {
    const data = new Map([
      [1, [
        { id: 1, carId: 1, date: '2026-01-01', odometerKm: 100, liters: 10, totalCost: 15, fullTank: true },
        { id: 2, carId: 1, date: '2026-01-10', odometerKm: 200, liters: 10, totalCost: 15, fullTank: true },
      ]],
      [2, [
        { id: 3, carId: 2, date: '2026-01-01', odometerKm: 1000, liters: 10, totalCost: 15, fullTank: true },
        { id: 4, carId: 2, date: '2026-01-10', odometerKm: 1100, liters: 10, totalCost: 15, fullTank: true },
      ]],
    ]);
    const report = calculateReport(data);
    expect(report.summary.distanceKm).toBe(100 + 100);
  });

  it('should handle empty set', () => {
    const report = calculateReport(new Map());
    expect(report.summary.totalCost).toBe(0);
    expect(report.summary.avgPricePerLiter).toBeNull();
    expect(report.monthly).toEqual([]);
  });

  it('should handle zero distance', () => {
    const data = new Map([[1, [
      { id: 1, carId: 1, date: '2026-01-01', odometerKm: 100, liters: 10, totalCost: 15, fullTank: true },
    ]]]);
    const report = calculateReport(data);
    expect(report.summary.distanceKm).toBe(0);
    expect(report.summary.avgConsumptionLPer100Km).toBeNull();
    expect(report.summary.costPerKm).toBeNull();
  });

  it('should drop segments with d <= 0', () => {
    const data = new Map([[1, [
      { id: 1, carId: 1, date: '2026-01-01', odometerKm: 1000, liters: 40, totalCost: 60, fullTank: true },
      { id: 2, carId: 1, date: '2026-01-10', odometerKm: 1000, liters: 20, totalCost: 30, fullTank: true },
    ]]]);
    const report = calculateReport(data);
    expect(report.summary.avgConsumptionLPer100Km).toBeNull();
  });

  it('should ignore partial fills before first full fill', () => {
    const data = new Map([[1, [
      { id: 1, carId: 1, date: '2026-01-01', odometerKm: 100, liters: 10, totalCost: 15, fullTank: false },
      { id: 2, carId: 1, date: '2026-01-10', odometerKm: 200, liters: 10, totalCost: 15, fullTank: true },
      { id: 3, carId: 1, date: '2026-01-20', odometerKm: 300, liters: 10, totalCost: 15, fullTank: true },
    ]]]);
    const report = calculateReport(data);
    // Only segment 200 -> 300 counts. Fuel = 10. Dist = 100. Consumption = 10/100*100 = 10.
    expect(report.summary.avgConsumptionLPer100Km).toBe(10);
  });
});
