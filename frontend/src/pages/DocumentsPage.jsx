import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import AppLayout from '../components/AppLayout';
import DocumentUploadForm from '../components/DocumentUploadForm';
import DocumentCard from '../components/DocumentCard';

export default function DocumentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const isStaff = user?.role === 'staff' || user?.role === 'admin';

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
        <h1 className="page-title">Ask Floss</h1>
        <p className="page-subtitle">
          Chat with the clinic's knowledge base — policies, hours, and the dentist directory. Every answer is
          cited, and Floss will never offer dental or medical advice.
        </p>

        <div className="documents-toolbar">
          {isStaff ? (
            <DocumentUploadForm onUploaded={handleUploaded} />
          ) : (
            <span className="page-subtitle" style={{ margin: 0 }}>
              {documents.length} document{documents.length === 1 ? '' : 's'} available
            </span>
          )}
          <button className="btn btn-secondary" onClick={handleChatAllDocuments} disabled={readyCount === 0}>
            💬 Start a conversation
          </button>
        </div>

        {loading ? (
          <>
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </>
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
