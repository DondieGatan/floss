import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { api } from './api/client';

vi.mock('./api/client', async () => {
  const actual = await vi.importActual('./api/client');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

// App renders ThemeProvider, which reads prefers-color-scheme on mount —
// jsdom doesn't implement matchMedia at all, unlike the individual-page
// tests elsewhere in this suite that never render that far up the tree.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

function renderAppAt(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

// staff/admin/owner have broad access to every patient's data, so 2FA is
// mandatory for them (see TWO_FACTOR_REQUIRED_ROLES in App.jsx); patients
// only ever see their own records, so it stays optional for them.
describe('2FA enforcement for staff-tier roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('floss_access_token', 'fake-token');
  });

  it('redirects a staff user without 2FA to Security instead of the page they asked for', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/auth/me') {
        return Promise.resolve({ user: { id: 1, fullName: 'Nora', role: 'staff', twoFactorEnabled: false } });
      }
      if (path === '/auth/2fa/status') return Promise.resolve({ enabled: false, method: null });
      return Promise.resolve({});
    });

    renderAppAt('/dashboard');

    expect(await screen.findByText('Two-factor authentication is off')).toBeInTheDocument();
  });

  it('lets a staff user who already has 2FA enabled reach the page they asked for', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/auth/me') {
        return Promise.resolve({ user: { id: 1, fullName: 'Nora', role: 'staff', twoFactorEnabled: true } });
      }
      return Promise.resolve({ appointments: [], admissions: [], beds: [] });
    });

    renderAppAt('/dashboard');

    expect(await screen.findByText(/Welcome back, Nora/)).toBeInTheDocument();
  });

  it('does not require 2FA for a patient', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/auth/me') {
        return Promise.resolve({ user: { id: 1, fullName: 'Jordan', role: 'patient', twoFactorEnabled: false } });
      }
      return Promise.resolve({ appointments: [] });
    });

    renderAppAt('/dashboard');

    expect(await screen.findByText(/Welcome back, Jordan/)).toBeInTheDocument();
  });

  it('lets a 2FA-incomplete staff user reach Security itself, no redirect loop', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/auth/me') {
        return Promise.resolve({ user: { id: 1, fullName: 'Nora', role: 'staff', twoFactorEnabled: false } });
      }
      if (path === '/auth/2fa/status') return Promise.resolve({ enabled: false, method: null });
      return Promise.resolve({});
    });

    renderAppAt('/security');

    expect(await screen.findByText('Two-factor authentication is off')).toBeInTheDocument();
  });
});
