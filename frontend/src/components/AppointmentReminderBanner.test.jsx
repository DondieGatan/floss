import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import AppointmentReminderBanner from './AppointmentReminderBanner';

function inHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function makeAppointment(overrides = {}) {
  return {
    id: 1,
    status: 'scheduled',
    doctorName: 'Dr. Amara Osei',
    scheduledStart: inHours(5),
    ...overrides,
  };
}

describe('AppointmentReminderBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nothing when there are no appointments within the window', () => {
    const { container } = render(
      <AppointmentReminderBanner appointments={[makeAppointment({ scheduledStart: inHours(48) })]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a past or cancelled appointment', () => {
    const { container } = render(
      <AppointmentReminderBanner
        appointments={[
          makeAppointment({ id: 1, scheduledStart: inHours(-1) }),
          makeAppointment({ id: 2, status: 'cancelled' }),
        ]}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a reminder for an appointment within 24 hours', () => {
    render(<AppointmentReminderBanner appointments={[makeAppointment()]} />);
    expect(screen.getByText(/Dr\. Amara Osei/)).toBeInTheDocument();
  });

  it('picks the soonest appointment when more than one is within the window', () => {
    render(
      <AppointmentReminderBanner
        appointments={[
          makeAppointment({ id: 1, doctorName: 'Dr. Later', scheduledStart: inHours(20) }),
          makeAppointment({ id: 2, doctorName: 'Dr. Sooner', scheduledStart: inHours(2) }),
        ]}
      />
    );
    expect(screen.getByText(/Dr\. Sooner/)).toBeInTheDocument();
  });

  it('dismissing hides it and remembers the dismissal across remounts', () => {
    const appointments = [makeAppointment()];
    const { unmount } = render(<AppointmentReminderBanner appointments={appointments} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss reminder' }));
    expect(screen.queryByText(/Dr\. Amara Osei/)).not.toBeInTheDocument();
    unmount();

    const { container } = render(<AppointmentReminderBanner appointments={appointments} />);
    expect(container).toBeEmptyDOMElement();
  });
});
