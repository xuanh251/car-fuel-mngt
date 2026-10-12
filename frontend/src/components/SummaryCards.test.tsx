import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryCards } from './SummaryCards';
import type { RefuelingStats } from '../lib/refuelingStats';

const stats: RefuelingStats = { count: 2, totalLiters: 70, totalCost: 108, avgPricePerLiter: 108 / 70, distanceKm: 500, avgConsumptionLPer100Km: 6, costPerKm: 0.216 };

describe('SummaryCards', () => {
  it('renders seven labeled cards with formatted values', () => {
    render(<SummaryCards stats={stats} />);
    expect(screen.getAllByTestId('summary-card')).toHaveLength(7);
    expect(screen.getByText('Refuelings count')).toBeInTheDocument();
    expect(screen.getByText('70.00 L')).toBeInTheDocument();
    expect(screen.getByText('108.00')).toBeInTheDocument();
    expect(screen.getByText('500 km')).toBeInTheDocument();
    expect(screen.getByText('6.0 L/100 km')).toBeInTheDocument();
    expect(screen.getByText('0.216 / km')).toBeInTheDocument();
  });

  it('shows an em dash for nullable values, including empty stats', () => {
    const empty: RefuelingStats = { count: 0, totalLiters: 0, totalCost: 0, avgPricePerLiter: null, distanceKm: 0, avgConsumptionLPer100Km: null, costPerKm: null };
    render(<SummaryCards stats={empty} />);
    expect(screen.getAllByTestId('summary-card')).toHaveLength(7);
    const cards = screen.getAllByTestId('summary-card');
    expect(within(cards[3]).getByText('—')).toBeInTheDocument();
    expect(within(cards[5]).getByText('—')).toBeInTheDocument();
    expect(within(cards[6]).getByText('—')).toBeInTheDocument();
  });
});
