import { useId, useState } from 'react';

export default function CitationPanel({ citations }) {
  const [open, setOpen] = useState(false);
  // One CitationPanel renders per assistant message (see MessageBubble.jsx)
  // — a static id here would duplicate across a conversation with more
  // than one cited reply.
  const listId = useId();

  if (!citations || citations.length === 0) return null;

  return (
    <div className="citation-panel">
      <button
        className="citation-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
      >
        {open ? 'Hide sources' : `Show sources (${citations.length})`}
      </button>
      {open && (
        <ul className="citation-list" id={listId}>
          {citations.map((c) => (
            <li key={c.chunkId} id={`citation-${c.index}`} className="citation-item">
              <span className="citation-index">[{c.index}]</span>
              <span className="citation-page">p. {c.pageNumber}</span>
              <p className="citation-excerpt">{c.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
