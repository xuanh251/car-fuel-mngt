import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { AppLayout } from './AppLayout';
import { api } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      auth: {
        me: vi.fn(),
        logout: vi.fn(),
      },
    },
  };
});

const renderLayout = (path: string) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/*"
            element={
              <AppLayout>
                <div>Page Body</div>
              </AppLayout>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.auth.me as any).mockResolvedValue({ user: { id: 1, email: 'driver@example.com' } });
  });

  it('marks the Cars item active on car pages', async () => {
    renderLayout('/cars/1/refuelings');

    await screen.findByText('driver@example.com');
    expect(screen.getByRole('menuitem', { name: 'Cars' })).toHaveClass('ant-menu-item-selected');
    expect(screen.getByRole('menuitem', { name: 'Report' })).not.toHaveClass('ant-menu-item-selected');
  });

  it('marks the Report item active on the report page', async () => {
    renderLayout('/report');

    await screen.findByText('driver@example.com');
    expect(screen.getByRole('menuitem', { name: 'Report' })).toHaveClass('ant-menu-item-selected');
    expect(screen.getByRole('menuitem', { name: 'Cars' })).not.toHaveClass('ant-menu-item-selected');
  });

  it('logs out and navigates to /login', async () => {
    (api.auth.logout as any).mockResolvedValue(undefined);
    renderLayout('/cars');

    await screen.findByText('driver@example.com');
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
    expect(api.auth.logout).toHaveBeenCalledTimes(1);
  });
});
