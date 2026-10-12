import type { RefuelingStats } from '../lib/refuelingStats';

interface SummaryCardsProps {
  stats: RefuelingStats;
}

export const SummaryCards = ({ stats }: SummaryCardsProps) => {
  const cards = [
    { label: 'Refuelings count', value: String(stats.count) },
    { label: 'Total liters', value: `${stats.totalLiters.toFixed(2)} L` },
    { label: 'Total cost', value: stats.totalCost.toFixed(2) },
    { label: 'Avg price/L', value: stats.avgPricePerLiter === null ? '—' : stats.avgPricePerLiter.toFixed(2) },
    { label: 'Total distance', value: `${Math.round(stats.distanceKm)} km` },
    { label: 'Avg consumption', value: stats.avgConsumptionLPer100Km === null ? '—' : `${stats.avgConsumptionLPer100Km.toFixed(1)} L/100 km` },
    { label: 'Avg cost/km', value: stats.costPerKm === null ? '—' : `${stats.costPerKm.toFixed(3)} / km` },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value }) => (
        <div key={label} data-testid="summary-card" className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-1 break-words text-xl font-semibold text-slate-900">{value}</div>
        </div>
      ))}
    </div>
  );
};
