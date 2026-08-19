import { useRef, useState } from 'react';
import { api, ApiError } from '../api/client';

export default function DocumentUploadForm({ onUploaded }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.upload('/documents', formData);
      onUploaded?.(data.document);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="upload-form">
      <label className="btn btn-primary upload-btn">
        {uploading ? 'Uploading…' : '+ Upload document'}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileChange}
          disabled={uploading}
          hidden
        />
      </label>
      <p className="upload-hint">PDF or TXT, up to 20MB.</p>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
