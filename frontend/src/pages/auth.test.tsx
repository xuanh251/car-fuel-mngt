import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { Login } from './Login';
import { Register } from './Register';
import { api } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      auth: {
        register: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
        me: vi.fn(),
      },
    },
  };
});

const MockCarsPage = () => <div>Cars Page</div>;

describe('auth pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers successfully and redirects to /cars', async () => {
    (api.auth.register as any).mockResolvedValue({
      user: { id: 1, email: 'test@example.com' },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="/cars" element={<MockCarsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByText('Cars Page')).toBeInTheDocument();
    });
    expect(api.auth.register).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('shows errors on registration failure', async () => {
    (api.auth.register as any).mockRejectedValue({
      message: 'Registration failed',
      fields: { email: 'Email already taken' },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<Register />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'taken@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText('Email already taken')).toHaveClass('ant-form-item-explain-error');
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Registration failed')).not.toBeInTheDocument();
  });

  it('shows a server error with an unknown field key in the top alert', async () => {
    (api.auth.register as any).mockRejectedValue({
      message: 'Registration failed',
      fields: { unknown: 'Something odd' },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<Register />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText('Registration failed')).toBeInTheDocument();
    expect(screen.queryByText('Something odd')).not.toBeInTheDocument();
  });

  it('shows required and email messages without calling the API', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<Register />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText('Please enter your email')).toBeInTheDocument();
    expect(screen.getByText('Please enter your password')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /register/i }));
    expect(await screen.findByText('Please enter a valid email')).toBeInTheDocument();

    expect(api.auth.register).not.toHaveBeenCalled();
  });

  it('logs in successfully and redirects to /cars', async () => {
    (api.auth.login as any).mockResolvedValue({
      user: { id: 1, email: 'test@example.com' },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cars" element={<MockCarsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText('Cars Page')).toBeInTheDocument();
    });
    expect(api.auth.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('shows errors on login failure', async () => {
    (api.auth.login as any).mockRejectedValue({
      message: 'Invalid credentials',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  it('shows a server field error on the login form item', async () => {
    (api.auth.login as any).mockRejectedValue({
      message: 'Login failed',
      fields: { password: 'Wrong password' },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Wrong password')).toHaveClass('ant-form-item-explain-error');
    expect(screen.queryByText('Login failed')).not.toBeInTheDocument();
  });
});
