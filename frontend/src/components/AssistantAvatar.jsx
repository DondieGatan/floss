function ToothMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3c1.2 0 1.8.6 4 .6s2.8-.6 4-.6c2.2 0 3.5 2 3.5 5 0 4-1.2 8-2.5 10.5-.5 1-1.2 1.9-2 1.9s-1-1.6-1.3-3.3c-.3-1.7-.7-3.1-1.7-3.1s-1.4 1.4-1.7 3.1c-.3 1.7-.5 3.3-1.3 3.3s-1.5-.9-2-1.9C5.7 16 4.5 12 4.5 8c0-3 1.3-5 3.5-5z" />
    </svg>
  );
}

export default function AssistantAvatar({ size = 'md' }) {
  return (
    <div className={`assistant-avatar assistant-avatar-${size}`} aria-hidden="true">
      <ToothMark />
    </div>
  );
}
