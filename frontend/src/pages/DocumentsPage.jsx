import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import DocumentUploadForm from '../components/DocumentUploadForm';
import DocumentCard from '../components/DocumentCard';
import { ChatIcon, FileIcon, CheckCircleIcon } from '../components/icons';

export default function DocumentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const isStaff = user?.role === 'staff' || user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    api.get('/documents').then((data) => {
      setDocuments(data.documents);
      setLoading(false);
    });
  }, []);

  function handleUploaded(document) {
    setDocuments((prev) => [document, ...prev]);
  }

  function handleDeleted(id) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleChatAllDocuments() {
    const data = await api.post('/chat/conversations', {});
    navigate(`/chat/${data.conversation.id}`);
  }

  const readyCount = documents.filter((d) => d.status === 'ready').length;

  return (
    <AppLayout>
      <div className="page-body">
        <div className="kb-hero">
          <div className="kb-hero-copy">
            <h1 className="page-title">Ask Floss Clinic</h1>
            <p className="page-subtitle">
              Chat with the clinic's knowledge base — policies, hours, the dentist directory, and general dental
              questions. Answers drawn from our own materials are cited; Floss Clinic will never offer medical
              advice or diagnose your symptoms.
            </p>
          </div>
          <button className="btn btn-primary kb-hero-cta" onClick={handleChatAllDocuments} disabled={readyCount === 0}>
            <ChatIcon /> Start a conversation
          </button>
        </div>

        <div className="stat-row kb-stats">
          <div className="stat-card">
            <div className="stat-icon" aria-hidden="true"><FileIcon /></div>
            <div className="stat-body">
              <p className="stat-value">{loading ? '–' : documents.length}</p>
              <p className="stat-label">{documents.length === 1 ? 'Document' : 'Documents'}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon-success" aria-hidden="true"><CheckCircleIcon /></div>
            <div className="stat-body">
              <p className="stat-value">{loading ? '–' : readyCount}</p>
              <p className="stat-label">Ready to answer</p>
            </div>
          </div>
        </div>

        {isStaff && <DocumentUploadForm onUploaded={handleUploaded} />}

        {loading ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading…</span>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <p>
              {isStaff
                ? 'No documents yet. Upload a PDF or text file to start building the knowledge base.'
                : 'Nothing in the knowledge base yet — check back soon.'}
            </p>
          </div>
        ) : (
          <div className="document-list stagger-in">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} document={doc} onDeleted={handleDeleted} canManage={isStaff} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
