import { useState, useCallback, useRef } from 'react';
import { API_BASE, getAccessToken } from '../api/client';

/**
 * Drives one conversation's message list, streaming the assistant's reply
 * token-by-token via fetch + ReadableStream (not EventSource — EventSource
 * can't attach a JWT Authorization header, which every Floss API call
 * needs).
 */
export function useChatStream(conversationId, initialMessages = []) {
  const [messages, setMessages] = useState(initialMessages);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const nextTempId = useRef(-1);

  const sendMessage = useCallback(async (content) => {
    setError(null);
    setSending(true);

    const userMessage = {
      id: nextTempId.current--,
      role: 'user',
      content,
      citedChunkIds: [],
      createdAt: new Date().toISOString(),
    };
    const assistantTempId = nextTempId.current--;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantTempId, role: 'assistant', content: '', citedChunkIds: [], createdAt: new Date().toISOString(), streaming: true },
    ]);

    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok || !res.body) {
        let message = 'Failed to reach the assistant.';
        try {
          const data = await res.json();
          if (data.error) message = data.error;
        } catch {
          // non-JSON error body — keep the generic message
        }
        throw new Error(message);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let frameEnd;
        while ((frameEnd = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, frameEnd);
          buffer = buffer.slice(frameEnd + 2);

          let eventName = null;
          let dataLine = null;
          for (const line of frame.split('\n')) {
            if (line.startsWith('event: ')) eventName = line.slice('event: '.length);
            else if (line.startsWith('data: ')) dataLine = line.slice('data: '.length);
          }
          if (dataLine === null) continue;
          const data = JSON.parse(dataLine);

          if (eventName === 'done') {
            setMessages((prev) => prev.map((m) => (m.id === assistantTempId ? { ...data, streaming: false } : m)));
          } else if (eventName === 'error') {
            setError(data.error || 'The assistant is temporarily unavailable.');
            setMessages((prev) => prev.filter((m) => m.id !== assistantTempId));
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantTempId ? { ...m, content: m.content + data } : m))
            );
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setMessages((prev) => prev.filter((m) => m.id !== assistantTempId));
    } finally {
      setSending(false);
    }
  }, [conversationId]);

  return { messages, setMessages, sending, error, sendMessage };
}
