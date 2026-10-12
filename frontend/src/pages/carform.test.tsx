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

// AntD Select has no native option elements: open it, then click the option by its text.
const selectFuelType = async (label: string) => {
  fireEvent.mouseDown(screen.getByLabelText(/fuel type/i));
  fireEvent.click(await screen.findByText(label));
};

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
    await selectFuelType('LPG');
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

    expect(await screen.findByText('Name is required')).toHaveClass('ant-form-item-explain-error');
    expect(screen.getByLabelText(/name/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows required message and does not call the API when name is empty', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cars/new']}>
          <Routes>
            <Route path="/cars/new" element={<CarForm />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /save car/i }));

    expect(await screen.findByText('Please enter a name')).toBeInTheDocument();
    expect(api.cars.create).not.toHaveBeenCalled();
  });

  it('sends empty optional numbers as undefined', async () => {
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

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Bare Car' } });
    fireEvent.click(screen.getByRole('button', { name: /save car/i }));

    await waitFor(() => {
      expect(screen.getByText('Cars Page')).toBeInTheDocument();
    });
    const body = (api.cars.create as any).mock.calls[0][0];
    expect(body.year).toBeUndefined();
    expect(body.tankCapacityL).toBeUndefined();
    expect(body).toMatchObject({ name: 'Bare Car', fuelType: 'petrol', initialOdometerKm: 0 });
  });
});
