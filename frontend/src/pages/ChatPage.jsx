import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import ChatWindow from '../components/ChatWindow';

export default function ChatPage() {
  const { conversationId } = useParams();
  const [messages, setMessages] = useState(null);

  useEffect(() => {
    setMessages(null);
    api.get(`/chat/conversations/${conversationId}/messages`).then((data) => {
      setMessages(data.messages);
    });
  }, [conversationId]);

  return (
    <AppLayout>
      <div className="page">
        <header className="page-header">
          <Link to="/knowledge-base" className="back-link">
            ← Knowledge Base
          </Link>
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
