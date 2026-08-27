import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DoctorProfilePage from './DoctorProfilePage';
import { AuthProvider } from '../context/AuthContext';
import { api, ApiError } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

const DOCTOR = {
  id: 1,
  fullName: 'Dr. Amara Osei',
  specialty: 'General & Preventive Dentistry',
  departmentName: 'General Dentistry',
  bio: 'Twelve years of practice, focused on preventive care.',
  photoUrl: null,
};

function renderProfile(entry = '/team/1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/team/:doctorId" element={<DoctorProfilePage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('DoctorProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the dentist highlight once loaded, fetched from the public endpoint', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/public/doctors/1') return Promise.resolve({ doctor: DOCTOR });
      return Promise.resolve({ user: null });
    });
    renderProfile();

    expect(await screen.findByRole('heading', { name: 'Dr. Amara Osei' })).toBeInTheDocument();
    expect(screen.getByText('General & Preventive Dentistry')).toBeInTheDocument();
    expect(screen.getByText(/Twelve years of practice/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/public/doctors/1');
  });

  it("shows a not-found message for a dentist id that doesn't exist", async () => {
    api.get.mockImplementation((path) => {
      if (path === '/public/doctors/999') return Promise.reject(new ApiError('Doctor not found.', 404));
      return Promise.resolve({ user: null });
    });
    renderProfile('/team/999');

    expect(await screen.findByText("We couldn't find that dentist.")).toBeInTheDocument();
  });

  it('sends a logged-out visitor to register rather than straight into booking', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/public/doctors/1') return Promise.resolve({ doctor: DOCTOR });
      return Promise.resolve({ user: null });
    });
    renderProfile();

    expect(await screen.findByRole('link', { name: 'Book with Dr. Amara Osei' })).toHaveAttribute('href', '/register');
  });

  it('deep-links a logged-in patient straight into booking this specific dentist', async () => {
    localStorage.setItem('floss_access_token', 'fake-token');
    api.get.mockImplementation((path) => {
      if (path === '/public/doctors/1') return Promise.resolve({ doctor: DOCTOR });
      if (path === '/auth/me') return Promise.resolve({ user: { id: 5, role: 'patient', fullName: 'Jordan Ellis' } });
      return Promise.resolve({ user: null });
    });
    renderProfile();

    // Two independent effects (the profile fetch and AuthContext's own
    // /auth/me check) settle at slightly different times — waitFor retries
    // until the href reflects both, instead of asserting against whichever
    // one happened to land first.
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Book with Dr. Amara Osei' })).toHaveAttribute('href', '/doctors/1/book');
    });
  });
});
