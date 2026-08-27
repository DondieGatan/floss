import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LandingPage from './LandingPage';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

function renderLanding() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LandingPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

// LandingPage fetches /public/doctors for its "Meet Our Dentists" section
// on every render regardless of login state, alongside AuthContext's own
// /auth/me check — this default keeps both resolving sensibly for tests
// that don't care about team content, and renderLoggedIn overrides just
// the /auth/me half.
function mockApiGet(user) {
  api.get.mockImplementation((path) => {
    if (path === '/public/doctors') return Promise.resolve({ doctors: [] });
    return Promise.resolve({ user });
  });
}

async function renderLoggedIn(user) {
  localStorage.setItem('floss_access_token', 'fake-token');
  mockApiGet(user);
  renderLanding();
  // Waits for AuthContext's own /auth/me check to resolve — until then
  // `user` is still null and the nav shows the logged-out state.
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  await within(nav).findByRole('link', { name: 'Dashboard' });
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockApiGet(null);
  });

  it('renders the hero headline and a working entry point for both roles', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your Best Dental Experience Awaits');
    expect(screen.getAllByRole('link', { name: /Get Started/i }).length).toBeGreaterThan(0);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
  });

  it('has exactly one h1, so the document outline stays valid for assistive tech', () => {
    renderLanding();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('offers a skip link as the first focusable element', () => {
    renderLanding();
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#main-content');
  });

  it('showcases the assistant with a sign-up CTA for an anonymous visitor', () => {
    renderLanding();
    expect(screen.getByText('Floss Assistant')).toBeInTheDocument();
    expect(screen.getByText(/What are your Saturday hours/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a Free Account' })).toHaveAttribute('href', '/register');
  });

  describe('the Meet Our Dentists section', () => {
    const DOCTORS = [
      { id: 1, fullName: 'Dr. Amara Osei', specialty: 'General & Preventive Dentistry', departmentName: 'General Dentistry', bio: 'Loves cleanings.', photoUrl: null },
      { id: 2, fullName: 'Dr. Liam Chen', specialty: 'Braces & Invisalign', departmentName: 'Orthodontics', bio: null, photoUrl: null },
    ];

    it('renders dentists fetched from the public endpoint, right on the landing page', async () => {
      api.get.mockImplementation((path) => {
        if (path === '/public/doctors') return Promise.resolve({ doctors: DOCTORS });
        return Promise.resolve({ user: null });
      });
      renderLanding();

      expect(await screen.findByText('Dr. Amara Osei')).toBeInTheDocument();
      expect(screen.getByText('Dr. Liam Chen')).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith('/public/doctors');
    });

    it("links each dentist card to their own highlight page, not the old doctors listing", async () => {
      api.get.mockImplementation((path) => {
        if (path === '/public/doctors') return Promise.resolve({ doctors: DOCTORS });
        return Promise.resolve({ user: null });
      });
      renderLanding();
      await screen.findByText('Dr. Amara Osei');

      const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/team/'));
      expect(links.map((l) => l.getAttribute('href')).sort()).toEqual(['/team/1', '/team/2']);
    });

    it('shows an empty state instead of an empty grid when the team directory has nobody in it', async () => {
      renderLanding();

      expect(await screen.findByText(/team directory is being updated/i)).toBeInTheDocument();
    });
  });

  describe('when already logged in', () => {
    it('shows an "Ask a Question" CTA to the dashboard for a patient', async () => {
      await renderLoggedIn({ id: 1, fullName: 'Jordan Ellis', role: 'patient' });

      expect(screen.getByText('Floss Assistant')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ask a Question' })).toHaveAttribute('href', '/dashboard');
    });

    it('sends staff to the Knowledge Base instead of the patient dashboard widget', async () => {
      await renderLoggedIn({ id: 2, fullName: 'Nora Bennett', role: 'staff' });

      expect(screen.getByRole('link', { name: 'Ask a Question' })).toHaveAttribute('href', '/knowledge-base');
    });

    it('every other CTA on the page also points somewhere real instead of the register dead end', async () => {
      await renderLoggedIn({ id: 1, fullName: 'Jordan Ellis', role: 'patient' });

      expect(screen.getByRole('link', { name: 'Learn More' })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: 'Explore All Services' })).toHaveAttribute('href', '/doctors');
      for (const link of screen.getAllByRole('link', { name: 'Learn more →' })) {
        expect(link).toHaveAttribute('href', '/doctors');
      }
      expect(screen.getByRole('link', { name: 'Book an Appointment' })).toHaveAttribute('href', '/doctors');
      expect(screen.getByRole('link', { name: 'Meet Our Dentists' })).toHaveAttribute('href', '/#team');
    });

    it('no longer shows a footer Dashboard link now that the nav already has one', async () => {
      await renderLoggedIn({ id: 1, fullName: 'Jordan Ellis', role: 'patient' });

      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1);
    });

    it('no link on the page still points at /register once logged in', async () => {
      await renderLoggedIn({ id: 1, fullName: 'Jordan Ellis', role: 'patient' });

      const registerLinks = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href') === '/register');
      expect(registerLinks).toHaveLength(0);
    });
  });
});
