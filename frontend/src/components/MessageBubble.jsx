import AssistantAvatar from './AssistantAvatar';

// Bold (**text**), italic (*text*), and citation markers ([1] or [1, 2]) in
// one pass, in whichever order they appear — the model interleaves them
// freely (e.g. "**Monday**[1]"). Bold is tried before italic so "**x**"
// isn't read as italic-wrapping-an-empty-string plus stray asterisks.
// Citation markers (with any leading space) are matched but not rendered —
// sources aren't shown, so a dangling "[1, 2]" with nothing to point to
// would just be confusing.
const INLINE_RE = /\*\*(.+?)\*\*|\*(.+?)\*|\s?\[\d+(?:,\s*\d+)*\]/g;

function renderInline(text, keyPrefix) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i}`}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${i}`}>{match[2]}</em>);
    }
    lastIndex = match.index + match[0].length;
    i += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const BULLET_RE = /^[-*]\s+/;

// Groups consecutive bullet lines into one <ul>, consecutive prose lines into
// one <p> — a "here's the list:" intro line followed by "- item" lines is
// common model output and needs to split into a paragraph plus a list, not
// be swallowed whole by either.
function groupLines(content) {
  const groups = [];
  for (const rawLine of content.split('\n')) {
    if (rawLine.trim() === '') continue;
    const isBullet = BULLET_RE.test(rawLine);
    const kind = isBullet ? 'list' : 'text';
    const line = isBullet ? rawLine.replace(BULLET_RE, '') : rawLine;
    const current = groups[groups.length - 1];
    if (current && current.kind === kind) {
      current.lines.push(line);
    } else {
      groups.push({ kind, lines: [line] });
    }
  }
  return groups;
}

function renderContent(content, streaming) {
  const groups = groupLines(content);
  const cursor = <span className="message-cursor" />;
  if (groups.length === 0) return streaming ? <p className="message-content">{cursor}</p> : null;
  const lastGroupIndex = groups.length - 1;

  return groups.map((group, groupIndex) => {
    const isLastGroup = groupIndex === lastGroupIndex;
    const lastLineIndex = group.lines.length - 1;

    if (group.kind === 'list') {
      return (
        <ul className="message-list" key={groupIndex}>
          {group.lines.map((line, i) => (
            <li key={i}>
              {renderInline(line, `${groupIndex}-${i}`)}
              {streaming && isLastGroup && i === lastLineIndex && cursor}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p className="message-content" key={groupIndex}>
        {group.lines.map((line, i) => (
          <span key={i}>
            {renderInline(line, `${groupIndex}-${i}`)}
            {i < lastLineIndex && <br />}
            {streaming && isLastGroup && i === lastLineIndex && cursor}
          </span>
        ))}
      </p>
    );
  });
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-row ${isUser ? 'message-row-user' : 'message-row-assistant'}`}>
      {!isUser && <AssistantAvatar size="sm" />}
      <div className={`message-bubble ${isUser ? 'message-bubble-user' : 'message-bubble-assistant'}`}>
        {renderContent(message.content, message.streaming)}
      </div>
    </div>
  );
}
