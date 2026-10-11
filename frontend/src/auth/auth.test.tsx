import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { RequireAuth } from './RequireAuth';
import { api } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      auth: {
        me: vi.fn(),
        logout: vi.fn(),
      },
    },
  };
});

const MockPage = () => <div>Protected Page</div>;
const LoginPage = () => <div>Login Page</div>;

describe('auth routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects anonymous user to /login', async () => {
    (api.auth.me as any).mockRejectedValue({ status: 401 });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route 
              path="/protected" 
              element={
                <RequireAuth>
                  <MockPage />
                </RequireAuth>
              } 
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('allows authenticated user to access protected page', async () => {
    (api.auth.me as any).mockResolvedValue({ user: { id: 1, email: 'test@example.com' } });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route 
              path="/protected" 
              element={
                <RequireAuth>
                  <MockPage />
                </RequireAuth>
              } 
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Page')).toBeInTheDocument();
    });
  });

  it('renders nothing while loading', async () => {
    (api.auth.me as any).mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <AuthProvider>
        <MemoryRouter>
          <RequireAuth>
            <MockPage />
          </RequireAuth>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByText('Protected Page')).not.toBeInTheDocument();
  });
});
