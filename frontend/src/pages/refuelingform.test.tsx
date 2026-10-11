import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { RefuelingForm } from './RefuelingForm';
import { api } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      refuelings: {
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

describe('RefuelingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new refueling successfully', async () => {
    (api.refuelings.create as any).mockResolvedValue({ id: 1 });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/1/refuelings/new']}>
          <Routes>
            <Route path="/cars/:carId/refuelings/new" element={<RefuelingForm />} />
            <Route path="/cars/1/refuelings" element={<div>Refuelings List</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/odometer/i), { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText(/liters/i), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/total cost/i), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /save refueling/i }));

    await waitFor(() => {
      expect(screen.getByText('Refuelings List')).toBeInTheDocument();
    });
    expect(api.refuelings.create).toHaveBeenCalledWith(1, expect.objectContaining({
      odometerKm: 1200,
      liters: 40,
      totalCost: 60,
    }));
  });

  it('updates an existing refueling successfully', async () => {
    (api.refuelings.get as any).mockResolvedValue({
      id: 1,
      carId: 1,
      date: '2026-01-01',
      odometerKm: 1000,
      liters: 40,
      totalCost: 60,
      pricePerLiter: 1.5,
      fullTank: true,
      notes: 'Old note',
      createdAt: '',
      updatedAt: '',
    });
    (api.refuelings.update as any).mockResolvedValue({ id: 1 });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/1/refuelings/1/edit']}>
          <Routes>
            <Route path="/cars/:carId/refuelings/:refuelingId/edit" element={<RefuelingForm />} />
            <Route path="/cars/1/refuelings" element={<div>Refuelings List</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/notes/i)).toHaveValue('Old note');
    });

    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'New note' } });
    fireEvent.click(screen.getByRole('button', { name: /save refueling/i }));

    await waitFor(() => {
      expect(screen.getByText('Refuelings List')).toBeInTheDocument();
    });
    expect(api.refuelings.update).toHaveBeenCalledWith(1, 1, expect.objectContaining({
      notes: 'New note',
    }));
  });

  it('shows live price per liter preview', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/1/refuelings/new']}>
          <Routes>
            <Route path="/cars/:carId/refuelings/new" element={<RefuelingForm />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/liters/i), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/total cost/i), { target: { value: '60' } });

    await waitFor(() => {
      expect(screen.getByText(/Price per Liter:/i)).toBeInTheDocument();
      expect(screen.getByText('1.50')).toBeInTheDocument();
    });
  });

  it('shows field errors from server', async () => {
    (api.refuelings.create as any).mockRejectedValue({
      status: 422,
      code: 'validation_failed',
      message: 'Validation failed',
      fields: { date: 'Date cannot be in the future' },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/1/refuelings/new']}>
          <Routes>
            <Route path="/cars/:carId/refuelings/new" element={<RefuelingForm />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Fill required fields to avoid browser validation preventing submit
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText(/odometer/i), { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText(/liters/i), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/total cost/i), { target: { value: '60' } });

    fireEvent.click(screen.getByRole('button', { name: /save refueling/i }));

    await waitFor(() => {
      expect(screen.getByText('Date cannot be in the future')).toBeInTheDocument();
      expect(screen.getByLabelText(/date/i)).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
