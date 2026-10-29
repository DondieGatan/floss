import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatWindow from './ChatWindow';
import { useChatStream } from '../hooks/useChatStream';
import { useBookingAssistant } from '../hooks/useBookingAssistant';

vi.mock('../hooks/useChatStream', () => ({ useChatStream: vi.fn() }));
vi.mock('../hooks/useBookingAssistant', () => ({ useBookingAssistant: vi.fn() }));

const bookingOff = {
  enabled: false,
  bookingMode: false,
  setBookingMode: vi.fn(),
  actions: [],
  sending: false,
  error: null,
  busy: null,
  sendBookingMessage: vi.fn(),
  resolveAction: vi.fn(),
};

describe('ChatWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBookingAssistant.mockReturnValue(bookingOff);
  });

  it('shows the empty-state prompt when there are no messages yet', () => {
    useChatStream.mockReturnValue({ messages: [], sending: false, error: null, sendMessage: vi.fn() });
    render(<ChatWindow conversationId="1" initialMessages={[]} />);

    expect(screen.getByText("Hi, I'm the Floss Assistant")).toBeInTheDocument();
  });

  it('renders prior messages without exposing sources or citation markers', () => {
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
    expect(screen.getByText('We are open 9-5.')).toBeInTheDocument();
    expect(screen.queryByText('Show sources (1)')).not.toBeInTheDocument();
  });

  it('stops the box at the 1000 characters the server accepts', () => {
    useChatStream.mockReturnValue({ messages: [], sending: false, error: null, sendMessage: vi.fn() });
    render(<ChatWindow conversationId="1" initialMessages={[]} />);

    expect(screen.getByLabelText('Ask a question')).toHaveAttribute('maxlength', '1000');
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

  describe('booking assistant', () => {
    const emptyChat = (sendMessage = vi.fn()) =>
      useChatStream.mockReturnValue({ messages: [], sending: false, error: null, sendMessage });

    it('does not show the booking switch when the assistant is not enabled', () => {
      emptyChat();
      render(<ChatWindow conversationId="1" initialMessages={[]} />);

      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('lets the patient turn booking help on', () => {
      const setBookingMode = vi.fn();
      useBookingAssistant.mockReturnValue({ ...bookingOff, enabled: true, setBookingMode });
      emptyChat();
      render(<ChatWindow conversationId="1" initialMessages={[]} />);

      fireEvent.click(screen.getByRole('switch', { name: 'Let the assistant help me book' }));

      expect(setBookingMode).toHaveBeenCalledWith(true);
    });

    it('sends to the booking assistant, not the normal chat, while booking help is on', () => {
      const sendMessage = vi.fn();
      const sendBookingMessage = vi.fn();
      useBookingAssistant.mockReturnValue({ ...bookingOff, enabled: true, bookingMode: true, sendBookingMessage });
      emptyChat(sendMessage);
      render(<ChatWindow conversationId="1" initialMessages={[]} />);

      const input = screen.getByLabelText('Ask a question');
      expect(input).toHaveAttribute('placeholder', "Tell me when you'd like to come in…");
      fireEvent.change(input, { target: { value: 'Monday at 10 please' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(sendBookingMessage).toHaveBeenCalledWith('Monday at 10 please');
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('keeps using the normal chat when booking help is switched off', () => {
      const sendMessage = vi.fn();
      useBookingAssistant.mockReturnValue({ ...bookingOff, enabled: true, bookingMode: false });
      emptyChat(sendMessage);
      render(<ChatWindow conversationId="1" initialMessages={[]} />);

      fireEvent.change(screen.getByLabelText('Ask a question'), { target: { value: 'What are your hours?' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(sendMessage).toHaveBeenCalledWith('What are your hours?');
    });

    it('shows a waiting request and resolves it only when a button is pressed', () => {
      const resolveAction = vi.fn();
      useBookingAssistant.mockReturnValue({
        ...bookingOff,
        enabled: true,
        actions: [{ id: 7, summary: 'Book Dr. Liam Chen on Monday, November 02, 2026 at 10:00 AM (30 min)' }],
        resolveAction,
      });
      emptyChat();
      render(<ChatWindow conversationId="1" initialMessages={[]} />);

      expect(screen.getByText(/Book Dr. Liam Chen on Monday/)).toBeInTheDocument();
      expect(resolveAction).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(resolveAction).toHaveBeenCalledWith(7, 'confirm');

      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
      expect(resolveAction).toHaveBeenCalledWith(7, 'reject');
    });

    it('tells the patient the assistant is busy and offers the normal booking page', () => {
      useBookingAssistant.mockReturnValue({
        ...bookingOff,
        enabled: true,
        bookingMode: true,
        busy: 'The booking assistant is busy right now. You can book directly from the Dentists page.',
      });
      emptyChat();
      render(
        <MemoryRouter>
          <ChatWindow conversationId="1" initialMessages={[]} />
        </MemoryRouter>
      );

      expect(screen.getByRole('status')).toHaveTextContent('The booking assistant is busy right now.');
      expect(screen.getByRole('link', { name: 'Choose a dentist and book' })).toHaveAttribute('href', '/doctors');
    });

    it('does not show the busy notice when booking help is off', () => {
      useBookingAssistant.mockReturnValue({ ...bookingOff, enabled: true, bookingMode: false, busy: 'busy' });
      emptyChat();
      render(
        <MemoryRouter>
          <ChatWindow conversationId="1" initialMessages={[]} />
        </MemoryRouter>
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('puts the message back in the box when it could not be delivered', async () => {
      const sendBookingMessage = vi.fn().mockResolvedValue(false);
      useBookingAssistant.mockReturnValue({ ...bookingOff, enabled: true, bookingMode: true, sendBookingMessage });
      emptyChat();
      render(<ChatWindow conversationId="1" initialMessages={[]} />);

      const input = screen.getByLabelText('Ask a question');
      fireEvent.change(input, { target: { value: 'Monday at 10 please' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(input).toHaveValue('Monday at 10 please'));
    });

    it('leaves the box empty once a message was delivered', async () => {
      const sendBookingMessage = vi.fn().mockResolvedValue(true);
      useBookingAssistant.mockReturnValue({ ...bookingOff, enabled: true, bookingMode: true, sendBookingMessage });
      emptyChat();
      render(<ChatWindow conversationId="1" initialMessages={[]} />);

      const input = screen.getByLabelText('Ask a question');
      fireEvent.change(input, { target: { value: 'Monday at 10 please' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(sendBookingMessage).toHaveBeenCalled());
      expect(input).toHaveValue('');
    });

    it('shows a booking error as an alert', () => {
      useBookingAssistant.mockReturnValue({ ...bookingOff, enabled: true, error: 'The assistant is temporarily unavailable.' });
      emptyChat();
      render(<ChatWindow conversationId="1" initialMessages={[]} />);

      expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
    });
  });
});
