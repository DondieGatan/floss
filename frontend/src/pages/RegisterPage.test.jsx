import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegisterPage from './RegisterPage';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return { ...actual, api: { ...actual.api, post: vi.fn(), get: vi.fn(), put: vi.fn() } };
});

function renderRegister(initialEntries = ['/register']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

function fillAndSubmit({ fullName = 'Jordan Ellis', email = 'jordan@example.com', password = 'password123' } = {}) {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: fullName } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /Create Account/ }));
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the brand and all three fields', () => {
    renderRegister();
    expect(screen.getByRole('heading', { name: /Floss Clinic/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('disables autofill so a new account never starts pre-filled with a previously-saved login', () => {
    renderRegister();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autoComplete', 'off');
    // "new-password" (not "off") is the actual signal browsers honor for
    // suppressing a saved-password suggestion on this field.
    expect(screen.getByLabelText('Password')).toHaveAttribute('autoComplete', 'new-password');
  });

  it('on success, registers and navigates to the dashboard', async () => {
    api.post.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 1, fullName: 'Jordan Ellis', role: 'patient' },
    });

    renderRegister();
    fillAndSubmit();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      fullName: 'Jordan Ellis',
      email: 'jordan@example.com',
      password: 'password123',
    });
  });

  it('on failure, shows the server error message instead of navigating', async () => {
    const { ApiError } = await vi.importActual('../api/client');
    api.post.mockRejectedValue(new ApiError('That email is already registered.', 409));

    renderRegister();
    fillAndSubmit();

    expect(await screen.findByText('That email is already registered.')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('disables the submit button and shows a pending label while registering', async () => {
    let resolveRegister;
    api.post.mockReturnValue(new Promise((resolve) => { resolveRegister = resolve; }));

    renderRegister();
    fillAndSubmit();

    const submitBtn = screen.getByRole('button', { name: /Creating account/ });
    expect(submitBtn).toBeDisabled();

    resolveRegister({ accessToken: 'a', refreshToken: 'r', user: { id: 1, fullName: 'Jordan', role: 'patient' } });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });

  describe('arriving from the landing page\'s Quick Book bar', () => {
    it('pre-fills the full name field from the name query param', () => {
      renderRegister(['/register?name=Jamie+Rivera']);
      expect(screen.getByLabelText('Full name')).toHaveValue('Jamie Rivera');
    });

    it('saves the phone query param to the new patient profile after registering', async () => {
      api.post.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 1, fullName: 'Jamie Rivera', role: 'patient' },
      });
      api.put.mockResolvedValue({ patient: {} });

      renderRegister(['/register?name=Jamie+Rivera&phone=555-0199']);
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jamie@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /Create Account/ }));

      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
      expect(api.put).toHaveBeenCalledWith('/patients/me', { phone: '555-0199' });
    });

    it('still navigates to the dashboard even if saving the phone fails', async () => {
      api.post.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 1, fullName: 'Jamie Rivera', role: 'patient' },
      });
      api.put.mockRejectedValue(new Error('network error'));

      renderRegister(['/register?phone=555-0199']);
      fillAndSubmit();

      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
    });

    it('does not call the profile endpoint when no phone was carried over', async () => {
      api.post.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 1, fullName: 'Jordan Ellis', role: 'patient' },
      });

      renderRegister(['/register']);
      fillAndSubmit();

      await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
      expect(api.put).not.toHaveBeenCalled();
    });
  });
});
