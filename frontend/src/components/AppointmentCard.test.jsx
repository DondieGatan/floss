import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppointmentCard from './AppointmentCard';

const baseAppointment = {
  id: 1,
  doctorName: 'Dr. Amara Osei',
  patientName: 'Jordan Ellis',
  scheduledStart: '2026-08-20T09:00:00',
  scheduledEnd: '2026-08-20T09:30:00',
  status: 'scheduled',
  reason: 'Cleaning',
};

describe('AppointmentCard', () => {
  it('renders the doctor name, status, and reason for a patient view', () => {
    render(<AppointmentCard appointment={baseAppointment} />);
    expect(screen.getByText('Dr. Amara Osei')).toBeInTheDocument();
    expect(screen.getByText('scheduled')).toBeInTheDocument();
    expect(screen.getByText('Cleaning')).toBeInTheDocument();
  });

  it('renders the patient name and doctor line for a staff view', () => {
    render(<AppointmentCard appointment={baseAppointment} showPatient />);
    expect(screen.getByText('Jordan Ellis')).toBeInTheDocument();
    expect(screen.getByText(/with Dr\. Amara Osei/)).toBeInTheDocument();
  });

  it('shows a Cancel button only for scheduled appointments, even when onCancel is provided', () => {
    const onCancel = vi.fn();
    const { rerender } = render(<AppointmentCard appointment={baseAppointment} onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    rerender(<AppointmentCard appointment={{ ...baseAppointment, status: 'cancelled' }} onCancel={onCancel} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('does not render a Cancel button when onCancel is omitted', () => {
    render(<AppointmentCard appointment={baseAppointment} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('calls onCancel with the appointment when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<AppointmentCard appointment={baseAppointment} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledWith(baseAppointment);
  });
});
