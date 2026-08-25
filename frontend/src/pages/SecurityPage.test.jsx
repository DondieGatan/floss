import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SecurityPage from './SecurityPage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

vi.mock('../components/AppLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
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
  });

  it('shows the enable button when 2FA is off', async () => {
    api.get.mockResolvedValue({ enabled: false });
    renderSecurity();

    expect(await screen.findByText('Two-factor authentication is off')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enable two-factor authentication/ })).toBeInTheDocument();
  });

  it('shows the disable button when 2FA is on', async () => {
    api.get.mockResolvedValue({ enabled: true });
    renderSecurity();

    expect(await screen.findByText('Two-factor authentication is on')).toBeInTheDocument();
  });

  it('walks through setup: secret shown, code confirmed, recovery codes revealed', async () => {
    api.get.mockResolvedValue({ enabled: false });
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
    fireEvent.click(await screen.findByRole('button', { name: /Enable two-factor authentication/ }));

    expect(await screen.findByText('ABCDEFGHIJKLMNOP')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm & enable/ }));

    expect(await screen.findByText('aaaa-1111')).toBeInTheDocument();
    expect(screen.getByText('bbbb-2222')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/2fa/enable', { code: '654321' });
  });

  it('disabling requires a password and calls the disable endpoint', async () => {
    api.get.mockResolvedValue({ enabled: true });
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
});
