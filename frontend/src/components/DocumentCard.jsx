import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const STATUS_LABEL = {
  pending: 'Pending…',
  processing: 'Processing…',
  ready: 'Ready',
  failed: 'Failed',
};

const TYPE_LABEL = {
  general: null,
  policy: 'Policy',
  faq: 'FAQ',
  directory_digest: 'Auto-generated · Dentist Directory',
};

export default function DocumentCard({ document, onDeleted, canManage }) {
  const navigate = useNavigate();
  const isDigest = document.documentType === 'directory_digest';

  async function handleChat() {
    const data = await api.post('/chat/conversations', { documentId: document.id });
    navigate(`/chat/${data.conversation.id}`);
  }

  async function handleDelete(e) {
    e.stopPropagation();
    await api.del(`/documents/${document.id}`);
    onDeleted?.(document.id);
  }

  return (
    <div className={`document-card status-${document.status}`}>
      <div className="document-card-main">
        <span className="document-filename">
          {TYPE_LABEL[document.documentType] && (
            <span className="document-type-tag">{TYPE_LABEL[document.documentType]}</span>
          )}
          {document.filename}
        </span>
        <span className={`status-badge status-badge-${document.status}`}>{STATUS_LABEL[document.status]}</span>
      </div>
      {document.status === 'failed' && document.errorMessage && (
        <p className="document-error">{document.errorMessage}</p>
      )}
      {document.status === 'ready' && (
        <p className="document-meta">{document.pageCount} page{document.pageCount === 1 ? '' : 's'}</p>
      )}
      <div className="document-card-actions">
        <button className="btn btn-small" onClick={handleChat} disabled={document.status !== 'ready'}>
          Chat
        </button>
        {canManage && !isDigest && (
          <button className="btn btn-small btn-ghost" onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
