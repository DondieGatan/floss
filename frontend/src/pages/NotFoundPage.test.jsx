import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import App from '../App';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

const mockUser = { current: null };
vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual('../context/AuthContext');
  return { ...actual, useAuth: () => ({ user: mockUser.current }) };
});

beforeEach(() => {
  mockUser.current = null;
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('NotFoundPage', () => {
  it('explains the page is missing and offers a way back home', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: "We couldn't find that page" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  });

  it('sends a signed-in visitor to their dashboard instead', () => {
    mockUser.current = { id: 1, fullName: 'Jordan Ellis', role: 'patient' };
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('is what the app shows for an address it has no page for, rather than redirecting home', async () => {
    api.get.mockResolvedValue({});
    window.history.pushState({}, '', '/definitely-not-a-page');
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: "We couldn't find that page" })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/definitely-not-a-page');
  });
});
