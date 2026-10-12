import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { Refuelings } from './Refuelings';
import { api } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      refuelings: {
        list: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe('Refuelings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no refuelings', async () => {
    (api.refuelings.list as any).mockResolvedValue({ refuelings: [] });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/1/refuelings']}>
          <Routes>
            <Route path="/cars/:carId/refuelings" element={<Refuelings />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/no refuelings found/i)).toBeInTheDocument();
    });
  });

  it('lists refuelings and allows deleting', async () => {
    const mockRefuelings = [
      { id: 1, carId: 1, date: '2026-01-01', odometerKm: 1000, liters: 40, totalCost: 60, pricePerLiter: 1.5, fullTank: true, notes: 'First fill', createdAt: '', updatedAt: '' },
    ];
    (api.refuelings.list as any).mockResolvedValue({ refuelings: mockRefuelings });
    (api.refuelings.delete as any).mockResolvedValue({});

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/1/refuelings']}>
          <Routes>
            <Route path="/cars/:carId/refuelings" element={<Refuelings />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('First fill')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByText(/are you sure you want to delete this refueling/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(api.refuelings.delete).toHaveBeenCalledWith(1, 1);
      expect(screen.queryByText('First fill')).not.toBeInTheDocument();
    });
  });

  it('links to the add page and closes the confirm dialog on Cancel', async () => {
    (api.refuelings.list as any).mockResolvedValue({
      refuelings: [
        { id: 1, carId: 1, date: '2026-01-01', odometerKm: 1000, liters: 40, totalCost: 60, pricePerLiter: 1.5, fullTank: true, notes: null, createdAt: '', updatedAt: '' },
      ],
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/1/refuelings']}>
          <Routes>
            <Route path="/cars/:carId/refuelings" element={<Refuelings />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('2026-01-01')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /add refueling/i })).toHaveAttribute('href', '/cars/1/refuelings/new');
    expect(screen.getByText('—')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText(/are you sure you want to delete this refueling/i)).not.toBeInTheDocument();
    });
    expect(api.refuelings.delete).not.toHaveBeenCalled();
  });
});
