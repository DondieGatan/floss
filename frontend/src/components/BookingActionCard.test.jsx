import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BookingActionCard from './BookingActionCard';

const action = { id: 3, summary: 'Cancel your appointment with Dr. Chen on Monday, November 02, 2026 at 10:00 AM' };

describe('BookingActionCard', () => {
  it('spells out exactly what would change and that it is waiting', () => {
    render(<BookingActionCard action={action} onConfirm={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText('Waiting for your confirmation')).toBeInTheDocument();
    expect(screen.getByText(action.summary)).toBeInTheDocument();
  });

  it('confirms and rejects by id, and nothing happens before a press', () => {
    const onConfirm = vi.fn();
    const onReject = vi.fn();
    render(<BookingActionCard action={action} onConfirm={onConfirm} onReject={onReject} />);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(onConfirm).toHaveBeenCalledWith(3);
    expect(onReject).toHaveBeenCalledWith(3);
  });

  it('locks both buttons while the request is being carried out', () => {
    render(<BookingActionCard action={{ ...action, busy: true }} onConfirm={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeDisabled();
  });
});
