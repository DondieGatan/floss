import { useEffect, useRef, useState } from 'react';
import { useChatStream } from '../hooks/useChatStream';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ conversationId, initialMessages }) {
  const { messages, sending, error, sendMessage } = useChatStream(conversationId, initialMessages);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    sendMessage(content);
  }

  return (
    <div className="chat-window">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Ask a question about this document to get started.</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <div className="form-error chat-error">{error}</div>}

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={sending}
        />
        <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
