import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdmissionsPage from './AdmissionsPage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('../components/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const ward = { id: 1, name: 'Ward A', wardType: 'General' };
const availableBed = { id: 10, bedNumber: '1', status: 'available' };
const patient = { id: 5, fullName: 'Jordan Ellis' };
const doctor = { id: 7, fullName: 'Dr. Amara Osei' };

function mockApi() {
  api.get.mockImplementation((path) => {
    if (path === '/wards') return Promise.resolve({ wards: [ward] });
    if (path === '/wards/1/beds') return Promise.resolve({ beds: [availableBed] });
    if (path === '/admissions?status=active') return Promise.resolve({ admissions: [] });
    if (path === '/patients?perPage=200') return Promise.resolve({ patients: [patient] });
    if (path === '/doctors') return Promise.resolve({ doctors: [doctor] });
    return Promise.reject(new Error(`unexpected path: ${path}`));
  });
}

describe('AdmissionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('shows a text status label on chair tiles, not just color', async () => {
    render(<AdmissionsPage />);
    const tile = await screen.findByRole('button', { name: 'Chair 1 — available' });
    expect(tile).toHaveTextContent('Open');
  });

  it('opening the admit modal moves focus in, and closing it (Escape) returns focus to the chair tile', async () => {
    render(<AdmissionsPage />);
    const tile = await screen.findByRole('button', { name: 'Chair 1 — available' });
    fireEvent.click(tile);

    const patientSelect = await screen.findByRole('combobox', { name: 'Patient' });
    await waitFor(() => expect(patientSelect).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(tile).toHaveFocus();
  });

  it('cancelling the admit modal also returns focus to the chair tile', async () => {
    render(<AdmissionsPage />);
    const tile = await screen.findByRole('button', { name: 'Chair 1 — available' });
    fireEvent.click(tile);
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(tile).toHaveFocus();
  });
});
