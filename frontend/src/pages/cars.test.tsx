import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { Cars } from './Cars';
import { api } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      cars: {
        list: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe('Cars page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no cars', async () => {
    (api.cars.list as any).mockResolvedValue({ cars: [] });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Cars />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/you have no cars/i)).toBeInTheDocument();
    });
  });

  it('lists cars and allows deleting', async () => {
    const mockCars = [
      { id: 1, name: 'Test Car', make: 'Toyota', model: 'Corolla', year: 2020, refuelingCount: 5 },
    ];
    (api.cars.list as any).mockResolvedValue({ cars: mockCars });
    (api.cars.delete as any).mockResolvedValue({});

    render(
      <AuthProvider>
        <MemoryRouter>
          <Cars />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Car')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByText(/delete "Test Car"?/i)).toBeInTheDocument();
    expect(screen.getByText(/deleting this car also deletes its 5 refuelings/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(api.cars.delete).toHaveBeenCalledWith(1);
      expect(screen.queryByText('Test Car')).not.toBeInTheDocument();
    });
  });

  it('shows correct confirmation text for 1 refueling', async () => {
    const mockCars = [
      { id: 1, name: 'Test Car', make: 'Toyota', model: 'Corolla', year: 2020, refuelingCount: 1 },
    ];
    (api.cars.list as any).mockResolvedValue({ cars: mockCars });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Cars />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Car')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByText(/deleting this car also deletes its 1 refueling/i)).toBeInTheDocument();
  });

  it('shows correct confirmation text for 0 refuelings', async () => {
    const mockCars = [
      { id: 1, name: 'Test Car', make: 'Toyota', model: 'Corolla', year: 2020, refuelingCount: 0 },
    ];
    (api.cars.list as any).mockResolvedValue({ cars: mockCars });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Cars />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Car')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    expect(screen.getByText(/deleting this car also deletes its 0 refuelings/i)).toBeInTheDocument();
  });

  it('closes the confirm dialog on Cancel without deleting', async () => {
    const mockCars = [
      { id: 1, name: 'Test Car', make: 'Toyota', model: 'Corolla', year: 2020, refuelingCount: 0 },
    ];
    (api.cars.list as any).mockResolvedValue({ cars: mockCars });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Cars />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Car')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText(/delete "Test Car"?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText(/delete "Test Car"?/i)).not.toBeInTheDocument();
    });
    expect(api.cars.delete).not.toHaveBeenCalled();
  });

  it('shows an alert when delete fails', async () => {
    const mockCars = [
      { id: 1, name: 'Test Car', make: 'Toyota', model: 'Corolla', year: 2020, refuelingCount: 0 },
    ];
    (api.cars.list as any).mockResolvedValue({ cars: mockCars });
    (api.cars.delete as any).mockRejectedValue({ message: 'Car is in use' });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Cars />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Car')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(await screen.findByText('Car is in use')).toBeInTheDocument();
    expect(screen.getByText('Test Car')).toBeInTheDocument();
  });
});
