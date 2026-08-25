import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import ChatWindow from '../components/ChatWindow';

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMessages(null);
    api.get(`/chat/conversations/${conversationId}/messages`).then((data) => {
      setMessages(data.messages);
    });
  }, [conversationId]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.del(`/chat/conversations/${conversationId}`);
      navigate('/knowledge-base');
    } catch {
      setDeleting(false);
    }
  }

  return (
    <AppLayout>
      <div className="page">
        <header className="page-header">
          <Link to="/knowledge-base" className="back-link">
            ← Knowledge Base
          </Link>
          <button className="btn btn-small btn-ghost" type="button" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete conversation'}
          </button>
        </header>

        <div className="page-body page-body-chat">
          {messages === null ? (
            <p className="page-loading" role="status" aria-live="polite">
              Loading…
            </p>
          ) : (
            <ChatWindow conversationId={conversationId} initialMessages={messages} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
