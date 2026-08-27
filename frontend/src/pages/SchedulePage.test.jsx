import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SchedulePage from './SchedulePage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { get: vi.fn() } }));
vi.mock('../components/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

function doctor(id, fullName) {
  return { id, fullName, specialty: 'General Dentistry' };
}

function appointment(id, doctorId, start, end, patientName, reason, status = 'scheduled') {
  return { id, doctorId, scheduledStart: start, scheduledEnd: end, patientName, reason, status };
}

describe('SchedulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges open slots and booked appointments into one sorted timeline per dentist', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/doctors') {
        return Promise.resolve({ doctors: [doctor(1, 'Dr. Amara Osei')] });
      }
      if (path.startsWith('/appointments?date=')) {
        return Promise.resolve({
          appointments: [appointment(1, 1, '2026-08-31T09:00:00', '2026-08-31T09:30:00', 'Jordan Ellis', 'Cleaning')],
        });
      }
      if (path.startsWith('/appointments/availability?doctorId=1')) {
        return Promise.resolve({ slots: ['2026-08-31T10:00:00'] });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    render(<SchedulePage />);

    expect(await screen.findByText(/9:00 AM–9:30 AM · Jordan Ellis · Cleaning/)).toBeInTheDocument();
    expect(await screen.findByText(/10:00 AM · Available/)).toBeInTheDocument();
  });

  it('excludes cancelled appointments from the booked list', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/doctors') return Promise.resolve({ doctors: [doctor(1, 'Dr. Amara Osei')] });
      if (path.startsWith('/appointments?date=')) {
        return Promise.resolve({
          appointments: [
            appointment(1, 1, '2026-08-31T09:00:00', '2026-08-31T09:30:00', 'Jordan Ellis', 'Cleaning', 'cancelled'),
          ],
        });
      }
      if (path.startsWith('/appointments/availability?doctorId=1')) {
        return Promise.resolve({ slots: [] });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    render(<SchedulePage />);

    expect(await screen.findByText('Not available on this date.')).toBeInTheDocument();
    expect(screen.queryByText(/Jordan Ellis/)).not.toBeInTheDocument();
  });

  it('shows "Not available on this date" for a dentist with no slots and no bookings', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/doctors') return Promise.resolve({ doctors: [doctor(2, 'Dr. Liam Chen')] });
      if (path.startsWith('/appointments?date=')) return Promise.resolve({ appointments: [] });
      if (path.startsWith('/appointments/availability?doctorId=2')) return Promise.resolve({ slots: [] });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    render(<SchedulePage />);

    expect(await screen.findByText('Not available on this date.')).toBeInTheDocument();
  });
});
