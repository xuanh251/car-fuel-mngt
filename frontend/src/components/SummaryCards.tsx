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
        <div key={label} data-testid="summary-card" className="summary-card min-w-0 rounded-xl border bg-white p-4">
          <div className="summary-card-label text-sm font-medium tracking-wide">{label}</div>
          <div className="mt-1 break-words text-xl font-semibold">{value}</div>
        </div>
      ))}
    </div>
  );
};
