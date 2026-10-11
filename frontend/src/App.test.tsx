import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App'
import { api } from './api/client'

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      auth: {
        ...actual.api.auth,
        me: vi.fn(),
      },
    },
  };
});

describe('App smoke test', () => {
  it('renders the "Get started" heading', async () => {
    (api.auth.me as any).mockResolvedValue({ user: { id: 1, email: 'test@example.com' } });
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Cars')).toBeInTheDocument()
    })
  })
})
