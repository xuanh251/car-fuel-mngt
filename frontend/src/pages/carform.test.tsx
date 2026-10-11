import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { CarForm } from './CarForm';
import { api } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      cars: {
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

describe('CarForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new car successfully', async () => {
    (api.cars.create as any).mockResolvedValue({ id: 1 });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/new']}>
          <Routes>
            <Route path="/cars/new" element={<CarForm />} />
            <Route path="/cars" element={<div>Cars Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Car' } });
    fireEvent.change(screen.getByLabelText(/fuel type/i), { target: { value: 'lpg' } });
    fireEvent.click(screen.getByRole('button', { name: /save car/i }));

    await waitFor(() => {
      expect(screen.getByText('Cars Page')).toBeInTheDocument();
    });
    expect(api.cars.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Car',
      fuelType: 'lpg',
    }));
  });

  it('edits an existing car successfully', async () => {
    (api.cars.get as any).mockResolvedValue({
      id: 1,
      name: 'Old Car',
      make: 'Toyota',
      model: 'Camry',
      year: 2010,
      licensePlate: 'ABC-123',
      fuelType: 'petrol',
      tankCapacityL: 50,
      initialOdometerKm: 1000,
      refuelingCount: 0,
      createdAt: '',
      updatedAt: '',
    });
    (api.cars.update as any).mockResolvedValue({ id: 1 });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/1/edit']}>
          <Routes>
            <Route path="/cars/:carId/edit" element={<CarForm />} />
            <Route path="/cars" element={<div>Cars Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('Old Car');
    });

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save car/i }));

    await waitFor(() => {
      expect(screen.getByText('Cars Page')).toBeInTheDocument();
    });
    expect(api.cars.update).toHaveBeenCalledWith(1, expect.objectContaining({
      name: 'New Name',
    }));
  });

  it('shows field errors from server', async () => {
    (api.cars.create as any).mockRejectedValue({
      status: 422,
      code: 'validation_failed',
      message: 'Validation failed',
      fields: { name: 'Name is required' },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/new']}>
          <Routes>
            <Route path="/cars/new" element={<CarForm />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Some Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save car/i }));

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
