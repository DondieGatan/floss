import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManageUsersPage from './ManageUsersPage';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api/client', () => ({ api: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('../components/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

function renderPage() {
  return render(<ManageUsersPage />);
}

describe('ManageUsersPage pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1, role: 'admin' } });
  });

  it('shows a Load more button when the first page has more users, and appends the next page on click', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/users?page=1') {
        return Promise.resolve({
          users: [{ id: 2, fullName: 'Alex Kim', email: 'alex@example.com', role: 'patient' }],
          page: 1,
          hasMore: true,
        });
      }
      if (path === '/users?page=2') {
        return Promise.resolve({
          users: [{ id: 3, fullName: 'Bo Chen', email: 'bo@example.com', role: 'patient' }],
          page: 2,
          hasMore: false,
        });
      }
      if (path === '/users/audit-log') return Promise.resolve({ entries: [] });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    renderPage();
    expect(await screen.findByText('Alex Kim')).toBeInTheDocument();
    const loadMore = screen.getByRole('button', { name: 'Load more' });

    fireEvent.click(loadMore);

    expect(await screen.findByText('Bo Chen')).toBeInTheDocument();
    expect(screen.getByText('Alex Kim')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument());
  });

  it('does not show Load more when the first page has everything', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/users?page=1') {
        return Promise.resolve({
          users: [{ id: 2, fullName: 'Alex Kim', email: 'alex@example.com', role: 'patient' }],
          page: 1,
          hasMore: false,
        });
      }
      if (path === '/users/audit-log') return Promise.resolve({ entries: [] });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    renderPage();
    await screen.findByText('Alex Kim');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
