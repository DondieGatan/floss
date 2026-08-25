import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManageDirectoryPage from './ManageDirectoryPage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('../components/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const doctor = {
  id: 1,
  fullName: 'Dr. Amara Osei',
  specialty: 'General',
  departmentName: 'General Dentistry',
  availability: [],
};

describe('ManageDirectoryPage — availability toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path === '/departments') return Promise.resolve({ departments: [] });
      if (path === '/doctors') return Promise.resolve({ doctors: [doctor] });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it('exposes aria-expanded on the availability toggle, matching its open/closed state', async () => {
    render(<ManageDirectoryPage />);
    const toggle = await screen.findByRole('button', { name: 'Manage availability' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    const hideToggle = screen.getByRole('button', { name: 'Hide availability' });
    expect(hideToggle).toHaveAttribute('aria-expanded', 'true');
  });
});
