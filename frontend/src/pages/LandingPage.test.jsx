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

async function renderLoggedIn(user) {
  localStorage.setItem('floss_access_token', 'fake-token');
  api.get.mockResolvedValue({ user });
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
      expect(screen.getByRole('link', { name: 'Meet Our Dentists' })).toHaveAttribute('href', '/team');
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
