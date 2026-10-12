import type { Refueling } from '../api/types';

export interface RefuelingStats {
  count: number;
  totalLiters: number;
  totalCost: number;
  avgPricePerLiter: number | null;
  distanceKm: number;
  avgConsumptionLPer100Km: number | null;
  costPerKm: number | null;
}

export const calculateRefuelingStats = (refuelings: Refueling[]): RefuelingStats => {
  const count = refuelings.length;
  const totalLiters = refuelings.reduce((sum, refueling) => sum + refueling.liters, 0);
  const totalCost = refuelings.reduce((sum, refueling) => sum + refueling.totalCost, 0);
  const odometers = refuelings.map((refueling) => refueling.odometerKm);
  const distanceKm = count < 2 ? 0 : Math.max(...odometers) - Math.min(...odometers);

  const sorted = [...refuelings].sort((a, b) =>
    a.date.localeCompare(b.date) || a.odometerKm - b.odometerKm || a.id - b.id,
  );
  let anchor: Refueling | null = null;
  let pendingFuel = 0;
  let segmentFuel = 0;
  let segmentDistance = 0;

  for (const refueling of sorted) {
    if (refueling.fullTank) {
      if (anchor) {
        const distance = refueling.odometerKm - anchor.odometerKm;
        if (distance > 0) {
          segmentFuel += pendingFuel + refueling.liters;
          segmentDistance += distance;
        }
      }
      anchor = refueling;
      pendingFuel = 0;
    } else if (anchor) {
      pendingFuel += refueling.liters;
    }
  }

  return {
    count,
    totalLiters,
    totalCost,
    avgPricePerLiter: totalLiters === 0 ? null : totalCost / totalLiters,
    distanceKm,
    avgConsumptionLPer100Km: segmentDistance > 0 ? (segmentFuel / segmentDistance) * 100 : null,
    costPerKm: distanceKm === 0 ? null : totalCost / distanceKm,
  };
};
