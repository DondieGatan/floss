import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManageUsersPage from './ManageUsersPage';
import { api, ApiError } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return { ...actual, api: { ...actual.api, get: vi.fn(), patch: vi.fn() } };
});

vi.mock('../components/AppLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const useAuthMock = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

const USERS = [
  { id: 1, fullName: 'Casey Owner', email: 'casey@floss.demo', role: 'owner' },
  { id: 2, fullName: 'Jamie Patient-Turned-Staff', email: 'jamie@floss.demo', role: 'staff' },
];

function renderPage() {
  return render(<ManageUsersPage />);
}

describe('ManageUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: { id: 1, fullName: 'Casey Owner', role: 'owner' } });
    api.get.mockImplementation((path) => {
      if (path.startsWith('/users?page=')) return Promise.resolve({ users: USERS, hasMore: false });
      if (path === '/users/audit-log') return Promise.resolve({ entries: [] });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it('warns that 2FA enforcement needs a fresh login after promoting someone', async () => {
    api.patch.mockResolvedValue({
      user: { id: 2, fullName: 'Jamie Patient-Turned-Staff', email: 'jamie@floss.demo', role: 'admin' },
    });

    renderPage();
    const select = await screen.findByLabelText('Change role for Jamie Patient-Turned-Staff');
    fireEvent.change(select, { target: { value: 'admin' } });

    expect(
      await screen.findByText(/won't be enforced until they log out and back in/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Jamie Patient-Turned-Staff is now admin/)).toBeInTheDocument();
    expect(api.patch).toHaveBeenCalledWith('/users/2/role', { role: 'admin' });
  });

  it('clears the notice once a new role change starts', async () => {
    api.patch.mockResolvedValue({
      user: { id: 2, fullName: 'Jamie Patient-Turned-Staff', email: 'jamie@floss.demo', role: 'admin' },
    });

    renderPage();
    const select = await screen.findByLabelText('Change role for Jamie Patient-Turned-Staff');
    fireEvent.change(select, { target: { value: 'admin' } });
    await screen.findByText(/is now admin/);

    let resolveSecond;
    api.patch.mockReturnValue(new Promise((resolve) => { resolveSecond = resolve; }));
    fireEvent.change(select, { target: { value: 'staff' } });

    await waitFor(() => expect(screen.queryByText(/is now admin/)).not.toBeInTheDocument());
    resolveSecond({ user: { id: 2, fullName: 'Jamie Patient-Turned-Staff', email: 'jamie@floss.demo', role: 'staff' } });
  });

  it('does not show the notice when a role change fails', async () => {
    api.patch.mockRejectedValue(new ApiError('Only an owner can manage admin accounts.', 403));

    renderPage();
    const select = await screen.findByLabelText('Change role for Jamie Patient-Turned-Staff');
    fireEvent.change(select, { target: { value: 'admin' } });

    expect(await screen.findByText('Only an owner can manage admin accounts.')).toBeInTheDocument();
    expect(screen.queryByText(/won't be enforced/)).not.toBeInTheDocument();
  });
});
