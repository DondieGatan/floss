import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeamPage from './TeamPage';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

function renderTeam() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TeamPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

const DOCTORS = [
  { id: 1, fullName: 'Dr. Amara Osei', specialty: 'General & Preventive Dentistry', departmentName: 'General Dentistry', bio: 'Loves cleanings.', photoUrl: null },
  { id: 2, fullName: 'Dr. Liam Chen', specialty: 'Braces & Invisalign', departmentName: 'Orthodontics', bio: null, photoUrl: null },
];

describe('TeamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches from the public, unauthenticated doctors endpoint — not the login-gated one', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/public/doctors') return Promise.resolve({ doctors: DOCTORS });
      return Promise.resolve({ user: null });
    });
    renderTeam();

    expect(await screen.findByText('Dr. Amara Osei')).toBeInTheDocument();
    expect(screen.getByText('Dr. Liam Chen')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/public/doctors');
  });

  it('links each dentist to their own highlight page, not the booking flow', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/public/doctors') return Promise.resolve({ doctors: DOCTORS });
      return Promise.resolve({ user: null });
    });
    renderTeam();
    await screen.findByText('Dr. Amara Osei');

    const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/team/'));
    expect(links.map((l) => l.getAttribute('href')).sort()).toEqual(['/team/1', '/team/2']);
  });

  it('shows an empty state when the team directory has nobody in it', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/public/doctors') return Promise.resolve({ doctors: [] });
      return Promise.resolve({ user: null });
    });
    renderTeam();

    expect(await screen.findByText(/team directory is being updated/i)).toBeInTheDocument();
  });
});
