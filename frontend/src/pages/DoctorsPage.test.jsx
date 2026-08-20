import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DoctorsPage from './DoctorsPage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { get: vi.fn() } }));

vi.mock('../components/AppLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

function renderDoctors() {
  return render(
    <MemoryRouter>
      <DoctorsPage />
    </MemoryRouter>
  );
}

const DEPARTMENTS = [
  { id: 1, name: 'General Dentistry' },
  { id: 2, name: 'Orthodontics' },
];

const DOCTORS = [
  { id: 1, fullName: 'Dr. Amara Osei', specialty: 'General & Preventive Dentistry', departmentName: 'General Dentistry' },
  { id: 2, fullName: 'Dr. Liam Chen', specialty: 'Braces & Invisalign', departmentName: 'Orthodontics' },
];

describe('DoctorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists doctors with a book-appointment link once loaded', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/departments') return Promise.resolve({ departments: DEPARTMENTS });
      return Promise.resolve({ doctors: DOCTORS });
    });
    renderDoctors();

    expect(await screen.findByText('Dr. Amara Osei')).toBeInTheDocument();
    expect(screen.getByText('Dr. Liam Chen')).toBeInTheDocument();
    const bookLinks = screen.getAllByRole('link', { name: 'Book appointment' });
    expect(bookLinks[0]).toHaveAttribute('href', '/doctors/1/book');
  });

  it('shows an empty state when no doctors match the department filter', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/departments') return Promise.resolve({ departments: DEPARTMENTS });
      return Promise.resolve({ doctors: [] });
    });
    renderDoctors();

    expect(await screen.findByText('No doctors found for this department yet.')).toBeInTheDocument();
  });

  it('re-fetches doctors scoped to the selected department', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/departments') return Promise.resolve({ departments: DEPARTMENTS });
      return Promise.resolve({ doctors: DOCTORS });
    });
    renderDoctors();
    await screen.findByText('Dr. Amara Osei');

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: '2' } });

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/doctors?departmentId=2'));
  });
});
