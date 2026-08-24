import { useState } from 'react';
import { api } from '../api/client';
import ChatWindow from './ChatWindow';

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-4.5 4v-4H5a1 1 0 0 1-1-1V5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function FloatingChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (conversationId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/chat/conversations', {});
      setConversationId(data.conversation.id);
    } catch {
      setError('Could not start a conversation. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="floating-chat">
      {open && (
        <div className="floating-chat-panel" role="dialog" aria-label="Ask Floss Clinic">
          <div className="floating-chat-header">
            <span>💬 Ask Floss Clinic</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
              <CloseIcon />
            </button>
          </div>
          <div className="floating-chat-body">
            {error ? (
              <p className="form-error" role="alert" style={{ margin: 16 }}>
                {error}
              </p>
            ) : loading || !conversationId ? (
              <p className="page-loading" role="status" aria-live="polite">
                Loading…
              </p>
            ) : (
              <ChatWindow conversationId={conversationId} initialMessages={[]} />
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className="floating-chat-fab"
        onClick={handleToggle}
        aria-label={open ? 'Close chat' : 'Ask Floss Clinic'}
        aria-expanded={open}
      >
        {open ? <CloseIcon /> : <ChatBubbleIcon />}
      </button>
    </div>
  );
}
