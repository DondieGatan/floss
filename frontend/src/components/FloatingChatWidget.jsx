import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import ChatWindow from './ChatWindow';
import AssistantAvatar from './AssistantAvatar';

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
  const panelRef = useRef(null);
  const fabRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  async function startConversation() {
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

  function handleClose() {
    setOpen(false);
  }

  async function handleToggle() {
    if (open) {
      handleClose();
      return;
    }
    setOpen(true);
    if (conversationId || loading) return;
    startConversation();
  }

  // Move focus into the dialog on open and back to the FAB on close, and
  // let Escape close it — without this, a keyboard/screen-reader user gets
  // no cue the dialog opened and no way out except tabbing past it.
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement;
      panelRef.current?.focus();
    } else if (previouslyFocusedRef.current) {
      fabRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="floating-chat">
      {open && (
        <div
          className="floating-chat-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Ask Floss Clinic"
          tabIndex={-1}
          ref={panelRef}
        >
          <div className="floating-chat-header">
            <div className="floating-chat-identity">
              <AssistantAvatar size="md" />
              <div className="floating-chat-identity-text">
                <span className="floating-chat-name">Floss Assistant</span>
                <span className="floating-chat-status">
                  <span className="floating-chat-status-dot" aria-hidden="true" />
                  Here to help
                </span>
              </div>
            </div>
            <div className="floating-chat-header-actions">
              <button type="button" onClick={handleClose} aria-label="Close chat">
                <CloseIcon />
              </button>
            </div>
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
              <ChatWindow key={conversationId} conversationId={conversationId} initialMessages={[]} />
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
        ref={fabRef}
      >
        {open ? <CloseIcon /> : <ChatBubbleIcon />}
      </button>
    </div>
  );
}
