import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { api } from './api/client';

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      auth: {
        ...actual.api.auth,
        me: vi.fn(),
        register: vi.fn(),
      },
      cars: {
        ...actual.api.cars,
        list: vi.fn(async () => ({ cars: [] })),
      },
    },
  };
});

// Timing of the link click vs. the form fill is covered by the Playwright spec.
// jsdom flushes route updates inside act(), so this test checks the flow only.
describe('Login -> Register via link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.auth.me as any).mockRejectedValue({ status: 401, message: 'Not logged in' });
    window.history.pushState({}, '', '/login');
  });

  it('posts the typed email and password exactly once and lands on /cars', async () => {
    (api.auth.register as any).mockResolvedValue({ user: { id: 1, email: 'typed@example.com' } });

    render(<App />);

    await screen.findByRole('heading', { name: 'Login' });
    fireEvent.click(screen.getByRole('link', { name: /register/i }));
    await screen.findByRole('heading', { name: 'Register' });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'typed@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/cars');
    });
    expect(api.auth.register).toHaveBeenCalledTimes(1);
    expect(api.auth.register).toHaveBeenCalledWith({
      email: 'typed@example.com',
      password: 'Password123!',
    });
  });
});
