import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AllAppointmentsPage from './AllAppointmentsPage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('../components/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

function makeAppointment(id, doctorName) {
  const start = new Date(Date.now() + 86400000).toISOString();
  return { id, doctorName, patientName: 'Jordan Ellis', status: 'scheduled', scheduledStart: start, scheduledEnd: start };
}

describe('AllAppointmentsPage pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path === '/doctors') return Promise.resolve({ doctors: [] });
      if (path === '/appointments?page=1') {
        return Promise.resolve({ appointments: [makeAppointment(1, 'Dr. Amara Osei')], page: 1, hasMore: true });
      }
      if (path === '/appointments?page=2') {
        return Promise.resolve({ appointments: [makeAppointment(2, 'Dr. Liam Chen')], page: 2, hasMore: false });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it('appends the next page of appointments on Load more, then hides the button', async () => {
    render(<AllAppointmentsPage />);

    expect(await screen.findByText(/Amara Osei/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText(/Liam Chen/)).toBeInTheDocument();
    expect(screen.getByText(/Amara Osei/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument());
  });

  it('resets to page 1 when a filter changes', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/doctors') return Promise.resolve({ doctors: [] });
      if (path === '/appointments?page=1') {
        return Promise.resolve({ appointments: [makeAppointment(1, 'Dr. Amara Osei')], page: 1, hasMore: true });
      }
      if (path === '/appointments?page=2') {
        return Promise.resolve({ appointments: [makeAppointment(2, 'Dr. Liam Chen')], page: 2, hasMore: false });
      }
      // Any filtered query (e.g. after the date changes) — content doesn't
      // matter for this test, only that it was requested at page 1.
      return Promise.resolve({ appointments: [], page: 1, hasMore: false });
    });

    render(<AllAppointmentsPage />);
    await screen.findByText(/Amara Osei/);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText(/Liam Chen/);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-01-01' } });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('date=2026-01-01&page=1')));
  });
});
