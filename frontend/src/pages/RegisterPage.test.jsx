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
  return { ...actual, api: { ...actual.api, post: vi.fn(), get: vi.fn() } };
});

function renderRegister() {
  return render(
    <MemoryRouter>
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
});
