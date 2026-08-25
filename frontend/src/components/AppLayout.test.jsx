import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppLayout from './AppLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../context/ThemeContext', () => ({ useTheme: vi.fn() }));
vi.mock('./FloatingChatWidget', () => ({ default: () => null }));

function renderLayout() {
  return render(
    <MemoryRouter>
      <AppLayout>
        <p>page content</p>
      </AppLayout>
    </MemoryRouter>
  );
}

describe('AppLayout mobile nav drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { fullName: 'Jordan Ellis', role: 'patient' }, logout: vi.fn() });
    useTheme.mockReturnValue({ theme: 'light', toggleTheme: vi.fn() });
  });

  it('moves focus into the drawer on open and back to the menu button on close', async () => {
    renderLayout();
    const menuBtn = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(menuBtn);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    await waitFor(() => expect(menuBtn).toHaveFocus());
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    renderLayout();
    const menuBtn = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(menuBtn);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(menuBtn).toHaveFocus());
  });

  it('traps Tab within the drawer while open, wrapping from the last focusable element back to the first', async () => {
    renderLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus());

    // The sidebar's own first focusable element is its "Back to the
    // website" brand link (it comes before the close button in DOM
    // order) — initial focus lands on the close button, but the trap's
    // boundary is whatever's actually first/last in the drawer's DOM.
    // Index 1: index 0 is the identical-looking brand link in the mobile
    // topbar, which sits outside the sidebar the trap is scoped to.
    const brandLink = screen.getAllByRole('link', { name: /Floss Clinic/ })[1];
    const logoutBtn = screen.getByRole('button', { name: 'Logout' });
    logoutBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(brandLink).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(logoutBtn).toHaveFocus();
  });
});
