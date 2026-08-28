import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FloatingChatWidget from './FloatingChatWidget';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { post: vi.fn() } }));

vi.mock('./ChatWindow', () => ({
  default: ({ conversationId }) => <div>Chat window for {conversationId}</div>,
}));

// Surfaces the router's current search string as text so a test can assert
// on it — MemoryRouter keeps its own in-memory history, not window.location.
function LocationSearchProbe() {
  return <span data-testid="location-search">{useLocation().search}</span>;
}

// A plain <FloatingChatWidget /> render still needs Router context now that
// it reads ?askQuestion= via useSearchParams.
function renderWidget(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <>
              <FloatingChatWidget />
              <LocationSearchProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('FloatingChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ conversation: { id: 1 } });
  });

  it('opens the dialog, starts a conversation, and moves focus into it', async () => {
    renderWidget();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Floss Clinic' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(await screen.findByText('Chat window for 1')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the FAB', async () => {
    renderWidget();
    const fab = screen.getByRole('button', { name: 'Ask Floss Clinic' });
    fireEvent.click(fab);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ask Floss Clinic' })).toHaveFocus());
  });

  it('does not offer export or delete controls', async () => {
    renderWidget();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Floss Clinic' }));
    await screen.findByText('Chat window for 1');

    expect(screen.queryByRole('button', { name: 'Delete this conversation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export this conversation' })).not.toBeInTheDocument();
  });

  it('pops itself open on arrival with ?askQuestion=1, and cleans the param up', async () => {
    renderWidget('/dashboard?askQuestion=1');

    await screen.findByRole('dialog');
    expect(await screen.findByText('Chat window for 1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''));
  });

  it('stays closed without the askQuestion param', () => {
    renderWidget('/dashboard');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
