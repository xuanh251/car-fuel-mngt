export interface Refueling {
  id: number;
  carId: number;
  date: string;
  odometerKm: number;
  liters: number;
  totalCost: number;
  fullTank: boolean;
}

export interface ReportSummary {
  totalCost: number;
  totalLiters: number;
  refuelingCount: number;
  avgPricePerLiter: number | null;
  distanceKm: number;
  avgConsumptionLPer100Km: number | null;
  costPerKm: number | null;
}

export interface MonthlyReport {
  month: string;
  liters: number;
  cost: number;
  refuelingCount: number;
}

export function calculateReport(refuelingsByCar: Map<number, Refueling[]>) {
  let totalCostCents = 0;
  let totalLiters = 0;
  let refuelingCount = 0;
  let totalDistanceKm = 0;
  let totalSegFuel = 0;
  let totalSegDist = 0;

  const monthlyCentsMap = new Map<string, { month: string, liters: number, costCents: number, refuelingCount: number }>();

  for (const [carId, refuelings] of refuelingsByCar) {
    if (refuelings.length === 0) continue;

    for (const r of refuelings) {
      totalCostCents += Math.round(r.totalCost * 100);
      totalLiters += r.liters;
      refuelingCount++;

      const month = r.date.slice(0, 7);
      const m = monthlyCentsMap.get(month) || { month, liters: 0, costCents: 0, refuelingCount: 0 };
      m.liters += r.liters;
      m.costCents += Math.round(r.totalCost * 100);
      m.refuelingCount++;
      monthlyCentsMap.set(month, m);
    }

    const odometers = refuelings.map(r => r.odometerKm);
    totalDistanceKm += Math.max(...odometers) - Math.min(...odometers);

    const sorted = [...refuelings].sort((a, b) => a.date.localeCompare(b.date) || a.odometerKm - b.odometerKm || a.id - b.id);
    
    let anchor: Refueling | null = null;
    let pendingFuel = 0;

    for (const r of sorted) {
      if (r.fullTank) {
        if (anchor) {
          const d = r.odometerKm - anchor.odometerKm;
          if (d > 0) {
            totalSegFuel += pendingFuel + r.liters;
            totalSegDist += d;
          }
        }
        anchor = r;
        pendingFuel = 0;
      } else {
        if (anchor) {
          pendingFuel += r.liters;
        }
      }
    }
  }

  const totalCost = totalCostCents / 100;

  return {
    summary: {
      totalCost,
      totalLiters,
      refuelingCount,
      avgPricePerLiter: totalLiters > 0 ? totalCost / totalLiters : null,
      distanceKm: totalDistanceKm,
      avgConsumptionLPer100Km: totalSegDist > 0 ? (totalSegFuel / totalSegDist) * 100 : null,
      costPerKm: totalDistanceKm > 0 ? totalCost / totalDistanceKm : null,
    },
    monthly: Array.from(monthlyCentsMap.values())
      .map(m => ({
        month: m.month,
        liters: m.liters,
        cost: m.costCents / 100,
        refuelingCount: m.refuelingCount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
