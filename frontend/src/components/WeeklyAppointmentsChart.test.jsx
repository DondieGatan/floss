import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WeeklyAppointmentsChart from './WeeklyAppointmentsChart';

const data = [
  { label: 'Mon', count: 2, isToday: false },
  { label: 'Tue', count: 0, isToday: false },
  { label: 'Wed', count: 5, isToday: true },
  { label: 'Thu', count: 0, isToday: false },
  { label: 'Fri', count: 3, isToday: false },
  { label: 'Sat', count: 0, isToday: false },
  { label: 'Sun', count: 0, isToday: false },
];

describe('WeeklyAppointmentsChart', () => {
  it('renders one bar per day with an accessible label summarizing all counts', () => {
    render(<WeeklyAppointmentsChart data={data} />);
    const chart = screen.getByRole('img', { name: /Mon 2.*Wed 5.*Fri 3/ });
    expect(chart).toBeInTheDocument();
  });

  it('renders every day label as text in the SVG', () => {
    render(<WeeklyAppointmentsChart data={data} />);
    for (const day of data) {
      expect(screen.getByText(day.label)).toBeInTheDocument();
    }
  });

  it('does not render a count label for a day with zero appointments', () => {
    render(<WeeklyAppointmentsChart data={data} />);
    // "0" should never appear as a bar's number label, even though three
    // days in the fixture have zero appointments.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders count labels for days with appointments', () => {
    render(<WeeklyAppointmentsChart data={data} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('handles an all-zero week without dividing by zero', () => {
    const allZero = data.map((d) => ({ ...d, count: 0 }));
    render(<WeeklyAppointmentsChart data={allZero} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});
