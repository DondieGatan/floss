import CitationPanel from './CitationPanel';

const CITATION_MARKER_RE = /\[(\d+)\]/g;

function renderContent(content) {
  const parts = [];
  let lastIndex = 0;
  let match;
  CITATION_MARKER_RE.lastIndex = 0;
  while ((match = CITATION_MARKER_RE.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
    parts.push(
      <sup key={match.index} className="citation-marker">
        {match[0]}
      </sup>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-row ${isUser ? 'message-row-user' : 'message-row-assistant'}`}>
      <div className={`message-bubble ${isUser ? 'message-bubble-user' : 'message-bubble-assistant'}`}>
        <p className="message-content">
          {renderContent(message.content)}
          {message.streaming && <span className="message-cursor" />}
        </p>
        {!isUser && !message.streaming && <CitationPanel citations={message.citations} />}
      </div>
    </div>
  );
}
