import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FloatingChatWidget from './FloatingChatWidget';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { post: vi.fn() } }));

vi.mock('./ChatWindow', () => ({
  default: ({ conversationId }) => <div>Chat window for {conversationId}</div>,
}));

describe('FloatingChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ conversation: { id: 1 } });
  });

  it('opens the dialog, starts a conversation, and moves focus into it', async () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Floss Clinic' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(await screen.findByText('Chat window for 1')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the FAB', async () => {
    render(<FloatingChatWidget />);
    const fab = screen.getByRole('button', { name: 'Ask Floss Clinic' });
    fireEvent.click(fab);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ask Floss Clinic' })).toHaveFocus());
  });

  it('does not offer export or delete controls', async () => {
    render(<FloatingChatWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Floss Clinic' }));
    await screen.findByText('Chat window for 1');

    expect(screen.queryByRole('button', { name: 'Delete this conversation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export this conversation' })).not.toBeInTheDocument();
  });
});
