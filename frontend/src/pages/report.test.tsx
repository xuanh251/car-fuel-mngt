import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { Report } from './Report';
import { api } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      report: vi.fn(),
      cars: {
        list: vi.fn(async () => ({ cars: [] })),
      },
    },
  };
});

describe('Report page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no refuelings', async () => {
    (api.report as any).mockResolvedValue({
      summary: {
        totalCost: 0,
        totalLiters: 0,
        refuelingCount: 0,
        avgPricePerLiter: null,
        distanceKm: 0,
        avgConsumptionLPer100Km: null,
        costPerKm: null,
      },
      monthly: [],
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Report />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/no data available/i)).toBeInTheDocument();
    });
  });

  it('renders summary tiles and monthly table', async () => {
    (api.report as any).mockResolvedValue({
      summary: {
        totalCost: 108,
        totalLiters: 70,
        refuelingCount: 2,
        avgPricePerLiter: 1.542857,
        distanceKm: 500,
        avgConsumptionLPer100Km: 6.0,
        costPerKm: 0.216,
      },
      monthly: [
        { month: '2026-01', liters: 70, cost: 108, refuelingCount: 2 },
      ],
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Report />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('108.00')[0]).toBeInTheDocument();
      expect(screen.getAllByText('70.00')[0]).toBeInTheDocument();
      expect(screen.getAllByText('2')[0]).toBeInTheDocument();
      expect(screen.getByText('1.54')).toBeInTheDocument();
      expect(screen.getByText('500 km')).toBeInTheDocument();
      expect(screen.getByText('6.0 L/100km')).toBeInTheDocument();
      expect(screen.getByText('0.216')).toBeInTheDocument();
      expect(screen.getByText('2026-01')).toBeInTheDocument();
    });
  });

  it('refetches when filters change', async () => {
    (api.report as any).mockResolvedValue({
      summary: {
        totalCost: 0,
        totalLiters: 0,
        refuelingCount: 0,
        avgPricePerLiter: null,
        distanceKm: 0,
        avgConsumptionLPer100Km: null,
        costPerKm: null,
      },
      monthly: [],
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Report />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(api.report).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText(/from/i), { target: { value: '2026-01-01' } });

    await waitFor(() => {
      expect(api.report).toHaveBeenCalledTimes(2);
      expect(api.report).toHaveBeenCalledWith(expect.objectContaining({
        from: '2026-01-01',
      }));
    });
  });

  it('shows error message on api failure', async () => {
    (api.report as any).mockRejectedValue({
      message: 'Report error',
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Report />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Report error')).toBeInTheDocument();
    });
  });

  it('shows only the field error for a 422 from > to', async () => {
    (api.report as any).mockRejectedValue({
      status: 422,
      message: 'from is after to',
      fields: { to: 'To date cannot be before from date' },
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Report />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('To date cannot be before from date')).toBeInTheDocument();
    });
    expect(screen.queryByText('from is after to')).not.toBeInTheDocument();
  });

  it('clears saved report and shows from error on 422', async () => {
    const reportImpl = (api.report as any).mockResolvedValue({
      summary: { totalCost: 100, totalLiters: 50, refuelingCount: 1, avgPricePerLiter: 1.5, distanceKm: 0, avgConsumptionLPer100Km: null, costPerKm: null },
      monthly: [],
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Report />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(reportImpl).toHaveBeenCalled();
    });

    // Now submit an invalid range
    (api.report as any).mockRejectedValue({
      status: 422,
      message: 'Invalid date range',
      fields: { from: 'From date cannot be in the future' },
    });

    fireEvent.change(screen.getByLabelText(/from/i), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText(/to/i), { target: { value: '2026-01-01' } });

    await waitFor(() => {
      expect(screen.queryByText('100.00')).not.toBeInTheDocument();
      expect(screen.getByText('From date cannot be in the future')).toBeInTheDocument();
    });
  });

  it('ignores a slow all-cars response that arrives after a car was picked', async () => {
    const summary = (totalLiters: number) => ({
      summary: { totalCost: totalLiters * 2, totalLiters, refuelingCount: 1, avgPricePerLiter: 2, distanceKm: 0, avgConsumptionLPer100Km: null, costPerKm: null },
      monthly: [],
    });
    let resolveAllCars!: (value: unknown) => void;
    (api.report as any)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveAllCars = resolve; }))
      .mockResolvedValueOnce(summary(10));
    (api.cars.list as any).mockResolvedValueOnce({ cars: [{ id: 2, name: 'Car B' }] });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Report />
        </MemoryRouter>
      </AuthProvider>
    );

    await screen.findByRole('option', { name: 'Car B' });
    fireEvent.change(screen.getByLabelText(/car/i), { target: { value: '2' } });

    const liters = () => screen.getByText('Total Liters').parentElement;
    await waitFor(() => {
      expect(liters()).toHaveTextContent('10.00');
    });

    await act(async () => {
      resolveAllCars(summary(50));
    });

    expect(liters()).toHaveTextContent('10.00');
    expect(liters()).not.toHaveTextContent('50.00');
  });
});
