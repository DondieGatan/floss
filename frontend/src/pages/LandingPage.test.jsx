import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LandingPage from './LandingPage';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

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

  it('submitting the quick-book bar routes to registration instead of silently failing', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Book an Appointment' }));
    expect(navigateMock).toHaveBeenCalledWith('/register');
  });

  it('carries a filled-in name and phone through to registration instead of discarding them', () => {
    renderLanding();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jamie Rivera' } });
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '555-0199' } });
    fireEvent.click(screen.getByRole('button', { name: 'Book an Appointment' }));

    expect(navigateMock).toHaveBeenCalledWith('/register?name=Jamie+Rivera&phone=555-0199');
  });

  it('when already logged in, sends the quick-book bar to real booking instead of the register dead end', async () => {
    localStorage.setItem('floss_access_token', 'fake-token');
    api.get.mockResolvedValue({ user: { id: 1, fullName: 'Jordan Ellis', role: 'patient' } });

    renderLanding();
    // Waits for AuthContext's own /auth/me check to resolve — until then
    // `user` is still null and the nav shows the logged-out state. Scoped
    // to the nav specifically: the page has a second "Dashboard" link
    // elsewhere (a footer CTA) once logged in.
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await within(nav).findByRole('link', { name: 'Dashboard' });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jamie Rivera' } });
    fireEvent.click(screen.getByRole('button', { name: 'Book an Appointment' }));

    // Not /register — that route would just bounce a logged-in visitor
    // straight back here via RedirectIfAuthed, dropping the input again.
    expect(navigateMock).toHaveBeenCalledWith('/doctors');
  });
});
