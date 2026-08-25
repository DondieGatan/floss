import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, downloadFile, ApiError } from '../api/client';
import AppLayout from '../components/AppLayout';
import ChatWindow from '../components/ChatWindow';

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

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

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadFile(`/chat/conversations/${conversationId}/export`, `floss-conversation-${conversationId}.txt`);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Could not export this conversation.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppLayout>
      <div className="page">
        <header className="page-header">
          <h1 className="sr-only">Conversation with Floss Clinic</h1>
          <Link to="/knowledge-base" className="back-link">
            ← Knowledge Base
          </Link>
          <div className="page-header-actions">
            {exportError && (
              <span className="form-error" role="alert" style={{ margin: 0 }}>
                {exportError}
              </span>
            )}
            <button className="btn btn-small btn-ghost" type="button" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export'}
            </button>
            <button className="btn btn-small btn-ghost" type="button" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete conversation'}
            </button>
          </div>
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
