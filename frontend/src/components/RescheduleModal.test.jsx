import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RescheduleModal from './RescheduleModal';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const appointment = {
  id: 7,
  doctorId: 3,
  doctorName: 'Dr. Amara Osei',
  scheduledStart: '2026-08-20T09:00:00',
  scheduledEnd: '2026-08-20T09:30:00',
  status: 'scheduled',
};

const doctors = [
  { id: 3, fullName: 'Dr. Amara Osei' },
  { id: 4, fullName: 'Dr. Liam Chen' },
];

function mockGet({ slots }) {
  api.get.mockImplementation((path) => {
    if (path === '/doctors') return Promise.resolve({ doctors });
    if (path.startsWith('/appointments/availability')) return Promise.resolve({ slots });
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
}

describe('RescheduleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches availability for the appointment doctor/duration on mount and renders open slots', async () => {
    mockGet({ slots: ['2026-08-20T10:00:00'] });
    render(<RescheduleModal appointment={appointment} onClose={vi.fn()} onRescheduled={vi.fn()} />);

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/appointments/availability?doctorId=3&date=2026-08-20&durationMinutes=30&excludeAppointmentId=7'
      )
    );
    expect(await screen.findByRole('button', { name: /10:00/ })).toBeInTheDocument();
  });

  it('confirms the selected slot via PATCH, including the current doctor, and reports the updated appointment', async () => {
    mockGet({ slots: ['2026-08-20T10:00:00'] });
    const updated = { ...appointment, scheduledStart: '2026-08-20T10:00:00' };
    api.patch.mockResolvedValue({ appointment: updated });
    const onRescheduled = vi.fn();
    const onClose = vi.fn();

    render(<RescheduleModal appointment={appointment} onClose={onClose} onRescheduled={onRescheduled} />);

    const slotBtn = await screen.findByRole('button', { name: /10:00/ });
    fireEvent.click(slotBtn);
    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/appointments/7/reschedule', {
        scheduledStart: '2026-08-20T10:00:00',
        doctorId: 3,
      })
    );
    expect(onRescheduled).toHaveBeenCalledWith(updated);
    expect(onClose).toHaveBeenCalled();
  });

  it('refetches availability for the newly selected doctor and includes it in the PATCH', async () => {
    mockGet({ slots: ['2026-08-20T11:00:00'] });
    api.patch.mockResolvedValue({ appointment: { ...appointment, doctorId: 4 } });

    render(<RescheduleModal appointment={appointment} onClose={vi.fn()} onRescheduled={vi.fn()} />);
    await screen.findByRole('button', { name: /11:00/ });

    fireEvent.change(screen.getByLabelText('Dentist'), { target: { value: '4' } });

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/appointments/availability?doctorId=4&date=2026-08-20&durationMinutes=30&excludeAppointmentId=7'
      )
    );

    const slotBtn = await screen.findByRole('button', { name: /11:00/ });
    fireEvent.click(slotBtn);
    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/appointments/7/reschedule', {
        scheduledStart: '2026-08-20T11:00:00',
        doctorId: 4,
      })
    );
  });

  it('shows an empty state when there are no open slots that day', async () => {
    mockGet({ slots: [] });
    render(<RescheduleModal appointment={appointment} onClose={vi.fn()} onRescheduled={vi.fn()} />);
    expect(await screen.findByText('No open slots on this date. Try another day.')).toBeInTheDocument();
  });

  it('closes without saving when Cancel is clicked', async () => {
    mockGet({ slots: [] });
    const onClose = vi.fn();
    render(<RescheduleModal appointment={appointment} onClose={onClose} onRescheduled={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
  });
});
