import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatWindow from './ChatWindow';
import { useChatStream } from '../hooks/useChatStream';

vi.mock('../hooks/useChatStream', () => ({ useChatStream: vi.fn() }));

describe('ChatWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty-state prompt when there are no messages yet', () => {
    useChatStream.mockReturnValue({ messages: [], sending: false, error: null, sendMessage: vi.fn() });
    render(<ChatWindow conversationId="1" initialMessages={[]} />);

    expect(screen.getByText("Hi, I'm the Floss Assistant")).toBeInTheDocument();
  });

  it('renders prior messages and their citation markers', () => {
    useChatStream.mockReturnValue({
      messages: [
        { id: 1, role: 'user', content: 'What are your hours?', citedChunkIds: [] },
        { id: 2, role: 'assistant', content: 'We are open 9-5[1].', citations: [{ chunkId: 9, index: 1, pageNumber: 1, excerpt: 'Hours: 9-5' }] },
      ],
      sending: false,
      error: null,
      sendMessage: vi.fn(),
    });
    render(<ChatWindow conversationId="1" initialMessages={[]} />);

    expect(screen.getByText('What are your hours?')).toBeInTheDocument();
    expect(screen.getByText('Show sources (1)')).toBeInTheDocument();
  });

  it('submits the typed question and clears the input', () => {
    const sendMessage = vi.fn();
    useChatStream.mockReturnValue({ messages: [], sending: false, error: null, sendMessage });
    render(<ChatWindow conversationId="1" initialMessages={[]} />);

    const input = screen.getByLabelText('Ask a question');
    fireEvent.change(input, { target: { value: 'Do you treat kids?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(sendMessage).toHaveBeenCalledWith('Do you treat kids?');
    expect(input).toHaveValue('');
  });

  it('disables the input and send button while a reply is streaming', () => {
    useChatStream.mockReturnValue({ messages: [], sending: true, error: null, sendMessage: vi.fn() });
    render(<ChatWindow conversationId="1" initialMessages={[]} />);

    expect(screen.getByLabelText('Ask a question')).toBeDisabled();
    expect(screen.getByRole('button', { name: '…' })).toBeDisabled();
  });

  it('surfaces a stream error as an alert', () => {
    useChatStream.mockReturnValue({
      messages: [],
      sending: false,
      error: 'The assistant is temporarily unavailable.',
      sendMessage: vi.fn(),
    });
    render(<ChatWindow conversationId="1" initialMessages={[]} />);

    expect(screen.getByRole('alert')).toHaveTextContent('The assistant is temporarily unavailable.');
  });
});
