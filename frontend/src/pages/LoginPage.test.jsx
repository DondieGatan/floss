import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './LoginPage';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return { ...actual, api: { ...actual.api, post: vi.fn(), get: vi.fn() } };
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

function fillAndSubmit(email = 'patient@floss.demo', password = 'password123') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /Sign In/ }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the brand and both fields', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: /Floss Clinic/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('on success, logs in and navigates to the homepage', async () => {
    api.post.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 1, fullName: 'Jordan Ellis', role: 'patient' },
    });

    renderLogin();
    fillAndSubmit();

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'patient@floss.demo', password: 'password123' });
  });

  it('on failure, shows the server error message instead of navigating', async () => {
    const { ApiError } = await vi.importActual('../api/client');
    api.post.mockRejectedValue(new ApiError('Invalid email or password.', 401));

    renderLogin();
    fillAndSubmit();

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('disables the submit button and shows a pending label while signing in', async () => {
    let resolveLogin;
    api.post.mockReturnValue(new Promise((resolve) => { resolveLogin = resolve; }));

    renderLogin();
    fillAndSubmit();

    const submitBtn = screen.getByRole('button', { name: /Signing in/ });
    expect(submitBtn).toBeDisabled();

    resolveLogin({ accessToken: 'a', refreshToken: 'r', user: { id: 1, fullName: 'Jordan', role: 'patient' } });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });
});
