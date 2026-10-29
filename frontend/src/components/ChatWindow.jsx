import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useChatStream } from '../hooks/useChatStream';
import { useBookingAssistant } from '../hooks/useBookingAssistant';
import MessageBubble from './MessageBubble';
import AssistantAvatar from './AssistantAvatar';
import BookingActionCard from './BookingActionCard';

// The server refuses longer messages (see app/chat/guardrails.py); stop the box
// from accepting them in the first place.
const MAX_MESSAGE_CHARS = 1000;

export default function ChatWindow({ conversationId, initialMessages }) {
  const chat = useChatStream(conversationId, initialMessages);
  const booking = useBookingAssistant(conversationId, chat.setMessages);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const sending = chat.sending || booking.sending;
  const error = chat.error || booking.error;
  const inBookingMode = booking.enabled && booking.bookingMode;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, booking.actions]);

  async function handleSubmit(e) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    if (inBookingMode) {
      const delivered = await booking.sendBookingMessage(content);
      // Not delivered (assistant busy or down): put the message back so it isn't lost.
      if (delivered === false) setInput((current) => current || content);
    } else {
      chat.sendMessage(content);
    }
  }

  return (
    <div className="chat-window">
      <div className="chat-messages" aria-live="polite">
        {chat.messages.length === 0 && (
          <div className="chat-empty-state">
            <AssistantAvatar size="lg" />
            <p className="chat-empty-title">Hi, I'm the Floss Assistant</p>
            <p className="chat-empty-subtitle">
              Ask me about appointments, dentists, hours, insurance, or clinic policies.
            </p>
          </div>
        )}
        {chat.messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {booking.actions.map((action) => (
          <BookingActionCard
            key={action.id}
            action={action}
            onConfirm={(id) => booking.resolveAction(id, 'confirm')}
            onReject={(id) => booking.resolveAction(id, 'reject')}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="form-error chat-error" role="alert">
          {error}
        </div>
      )}

      {inBookingMode && booking.busy && (
        <div className="chat-busy-notice" role="status">
          <p>{booking.busy}</p>
          <Link className="btn btn-secondary" to="/doctors">
            Choose a dentist and book
          </Link>
        </div>
      )}

      {booking.enabled && (
        <label className="booking-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={booking.bookingMode}
            onChange={(e) => booking.setBookingMode(e.target.checked)}
          />
          <span>Let the assistant help me book</span>
        </label>
      )}

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="chat-message-input">
          Ask a question
        </label>
        <input
          id="chat-message-input"
          type="text"
          maxLength={MAX_MESSAGE_CHARS}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={inBookingMode ? "Tell me when you'd like to come in…" : 'Ask a question…'}
          disabled={sending}
        />
        <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
