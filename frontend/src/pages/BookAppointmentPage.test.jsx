import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BookAppointmentPage from './BookAppointmentPage';
import { api, ApiError } from '../api/client';

vi.mock('../api/client', () => {
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }
  return { api: { get: vi.fn(), post: vi.fn() }, ApiError };
});

vi.mock('../components/AppLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const mockDoctor = { id: 1, fullName: 'Dr. Amara Osei', specialty: 'General & Preventive Dentistry' };
const mockSlots = ['2026-08-20T09:00:00', '2026-08-20T09:30:00'];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/doctors/1/book']}>
      <Routes>
        <Route path="/doctors/:doctorId/book" element={<BookAppointmentPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('BookAppointmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path.startsWith('/doctors/')) return Promise.resolve({ doctor: mockDoctor });
      if (path.startsWith('/appointments/availability')) return Promise.resolve({ slots: mockSlots });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it('loads the doctor and renders their open slots for the selected date', async () => {
    renderPage();
    expect(await screen.findByText(/Book with Dr\. Amara Osei/)).toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: /AM|PM/ })).toHaveLength(2);
  });

  it('selecting a slot reveals the reason field and a confirm button', async () => {
    renderPage();
    const slotButtons = await screen.findAllByRole('button', { name: /AM|PM/ });
    expect(slotButtons[0]).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(slotButtons[0]);
    expect(screen.getByPlaceholderText(/Annual check-up/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm/ })).toBeInTheDocument();
    expect(slotButtons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(slotButtons[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('confirms the booking, posts the right payload, and shows the success screen', async () => {
    api.post.mockResolvedValue({ appointment: { scheduledStart: mockSlots[0] } });
    renderPage();

    const slotButtons = await screen.findAllByRole('button', { name: /AM|PM/ });
    fireEvent.click(slotButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));

    expect(await screen.findByText('Appointment booked')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith(
      '/appointments',
      expect.objectContaining({ doctorId: 1, scheduledStart: mockSlots[0], durationMinutes: 30 })
    );
  });

  it('the success screen\'s primary action goes to the dashboard, where the new booking actually shows up (not history, which excludes upcoming appointments by design)', async () => {
    api.post.mockResolvedValue({ appointment: { scheduledStart: mockSlots[0] } });
    render(
      <MemoryRouter initialEntries={['/doctors/1/book']}>
        <Routes>
          <Route path="/doctors/:doctorId/book" element={<BookAppointmentPage />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const slotButtons = await screen.findAllByRole('button', { name: /AM|PM/ });
    fireEvent.click(slotButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await screen.findByText('Appointment booked');

    fireEvent.click(screen.getByRole('button', { name: /Go to dashboard/ }));
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('shows an empty state when the doctor has no open slots that day', async () => {
    api.get.mockImplementation((path) => {
      if (path.startsWith('/doctors/')) return Promise.resolve({ doctor: mockDoctor });
      if (path.startsWith('/appointments/availability')) return Promise.resolve({ slots: [] });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
    renderPage();
    expect(await screen.findByText(/No open slots on this date/)).toBeInTheDocument();
  });

  it('surfaces a booking conflict from the API as an error, not a crash', async () => {
    api.post.mockRejectedValue(new ApiError('This time slot is no longer available.', 409));
    renderPage();

    const slotButtons = await screen.findAllByRole('button', { name: /AM|PM/ });
    fireEvent.click(slotButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));

    expect(await screen.findByText('This time slot is no longer available.')).toBeInTheDocument();
  });
});
