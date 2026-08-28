import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SecurityPage from './SecurityPage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

vi.mock('../components/AppLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const useAuthMock = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

function renderSecurity() {
  return render(
    <MemoryRouter>
      <SecurityPage />
    </MemoryRouter>
  );
}

describe('SecurityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { email: 'alex@example.com', role: 'patient' } });
  });

  it('shows both method choices when 2FA is off', async () => {
    api.get.mockResolvedValue({ enabled: false, method: null });
    renderSecurity();

    expect(await screen.findByText('Two-factor authentication is off')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use an authenticator app/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Email me a code/ })).toBeInTheDocument();
  });

  it('shows the disable button and current method when 2FA is on', async () => {
    api.get.mockResolvedValue({ enabled: true, method: 'email' });
    renderSecurity();

    expect(await screen.findByText('Two-factor authentication is on')).toBeInTheDocument();
    expect(screen.getByText(/protected with email codes/)).toBeInTheDocument();
  });

  it('walks through authenticator-app setup: secret shown, code confirmed, recovery codes revealed', async () => {
    api.get.mockResolvedValue({ enabled: false, method: null });
    api.post.mockImplementation((path) => {
      if (path === '/auth/2fa/setup') {
        return Promise.resolve({ secret: 'ABCDEFGHIJKLMNOP', otpauthUrl: 'otpauth://totp/x' });
      }
      if (path === '/auth/2fa/enable') {
        return Promise.resolve({ recoveryCodes: ['aaaa-1111', 'bbbb-2222'] });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    renderSecurity();
    fireEvent.click(await screen.findByRole('button', { name: /Use an authenticator app/ }));

    expect(await screen.findByText('ABCDEFGHIJKLMNOP')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm & enable/ }));

    expect(await screen.findByText('aaaa-1111')).toBeInTheDocument();
    expect(screen.getByText('bbbb-2222')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/2fa/enable', { code: '654321' });
  });

  it('walks through email setup: code sent, confirmed, recovery codes revealed', async () => {
    api.get.mockResolvedValue({ enabled: false, method: null });
    api.post.mockImplementation((path) => {
      if (path === '/auth/2fa/email/setup') {
        return Promise.resolve({ setupToken: 'setup-token-123', email: 'alex@example.com', devCode: '654321' });
      }
      if (path === '/auth/2fa/email/enable') {
        return Promise.resolve({ recoveryCodes: ['cccc-3333', 'dddd-4444'] });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    renderSecurity();
    fireEvent.click(await screen.findByRole('button', { name: /Email me a code/ }));

    expect(await screen.findByText(/sent a 6-digit code to/)).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('654321')).toBeInTheDocument(); // dev-only code hint

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm & enable/ }));

    expect(await screen.findByText('cccc-3333')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/2fa/email/enable', {
      setupToken: 'setup-token-123',
      code: '654321',
    });
  });

  it('disabling requires a password and calls the disable endpoint', async () => {
    api.get.mockResolvedValue({ enabled: true, method: 'totp' });
    api.post.mockResolvedValue({ message: 'Two-factor authentication is now disabled.' });

    renderSecurity();
    fireEvent.click(await screen.findByRole('button', { name: /Disable two-factor authentication/ }));

    fireEvent.change(screen.getByLabelText(/Confirm your password/), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Disable two-factor authentication$/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/auth/2fa/disable', { password: 'password123' })
    );
    expect(await screen.findByText('Two-factor authentication is off')).toBeInTheDocument();
  });

  describe('for a staff-tier role, where 2FA is required rather than optional', () => {
    beforeEach(() => {
      useAuthMock.mockReturnValue({ user: { email: 'nora@floss.demo', role: 'staff' } });
    });

    it('explains it is required and offers no way to skip it', async () => {
      api.get.mockResolvedValue({ enabled: false, method: null });
      renderSecurity();

      expect(await screen.findByText(/required for staff accounts/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use an authenticator app/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Email me a code/ })).toBeInTheDocument();
    });

    it('does not offer a disable option once enabled', async () => {
      api.get.mockResolvedValue({ enabled: true, method: 'totp' });
      renderSecurity();

      expect(await screen.findByText('Two-factor authentication is on')).toBeInTheDocument();
      expect(screen.getByText(/required for staff accounts and can't be turned off/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Disable two-factor authentication/ })).not.toBeInTheDocument();
    });
  });
});
