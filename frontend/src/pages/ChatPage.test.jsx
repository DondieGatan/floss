import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatPage from './ChatPage';
import { api, downloadFile, ApiError } from '../api/client';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock, useParams: () => ({ conversationId: '7' }) };
});

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), del: vi.fn() },
  downloadFile: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('../components/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../components/ChatWindow', () => ({ default: () => <div>chat window</div> }));

function renderPage() {
  return render(
    <MemoryRouter>
      <ChatPage />
    </MemoryRouter>
  );
}

describe('ChatPage export/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ messages: [] });
  });

  it('exports the conversation via downloadFile', async () => {
    downloadFile.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('chat window');

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() =>
      expect(downloadFile).toHaveBeenCalledWith('/chat/conversations/7/export', 'floss-conversation-7.txt')
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows an error if the export fails, without navigating away', async () => {
    downloadFile.mockRejectedValue(new ApiError('Could not download the file (404).', 404));
    renderPage();
    await screen.findByText('chat window');

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(await screen.findByText('Could not download the file (404).')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('deletes the conversation and navigates back to the knowledge base', async () => {
    api.del.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('chat window');

    fireEvent.click(screen.getByRole('button', { name: 'Delete conversation' }));

    await waitFor(() => expect(api.del).toHaveBeenCalledWith('/chat/conversations/7'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/knowledge-base'));
  });
});
