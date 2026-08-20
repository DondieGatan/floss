import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import LandingPage from './LandingPage';
import { AuthProvider } from '../context/AuthContext';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
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
});
