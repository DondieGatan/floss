import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

// Shown up front when the server says every model is rate-limited right now.
// (When a message actually hits the limit, the server's own wording is used.)
const BUSY_TEXT =
  'The booking assistant is busy right now. You can book directly from the Dentists page, or try again in a few minutes.';

/**
 * The booking assistant's side of a chat conversation: whether the server has
 * it switched on, the "booking mode" toggle, and the requests the assistant
 * has proposed for the patient to confirm.
 *
 * Messages live in useChatStream's list (so the transcript is one thing) —
 * this hook only appends to it through `setMessages`. Booking replies come
 * back as one JSON response rather than a token stream, because the assistant
 * may call several tools before it has an answer to show.
 *
 * Nothing the assistant proposes happens until the patient presses Confirm:
 * proposals arrive here as `actions` with status "pending", and only
 * resolveAction() — a button press — asks the server to carry one out.
 */
export function useBookingAssistant(conversationId, setMessages) {
  const [enabled, setEnabled] = useState(false);
  const [bookingMode, setBookingMode] = useState(false);
  const [actions, setActions] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  // Set while the assistant's models are rate-limited: not an error, a "come
  // back later or use the normal booking page" notice.
  const [busy, setBusy] = useState(null);
  const nextTempId = useRef(-1_000_000);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const status = await api.get('/agent/status');
        if (cancelled || !status?.enabled) return;
        setEnabled(true);
        if (status.available === false) setBusy(BUSY_TEXT);
        const pending = await api.get(`/agent/conversations/${conversationId}/actions`);
        if (!cancelled) setActions(pending?.actions || []);
      } catch {
        // Booking help is an extra: if the check fails, the chat just works as before.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const appendAssistantMessage = useCallback(
    (content) => {
      setMessages((prev) => [
        ...prev,
        { id: nextTempId.current--, role: 'assistant', content, citedChunkIds: [], createdAt: new Date().toISOString() },
      ]);
    },
    [setMessages]
  );

  /** Resolves true when the assistant answered, false when the message was not delivered. */
  const sendBookingMessage = useCallback(
    async (content) => {
      setError(null);
      setSending(true);
      const userId = nextTempId.current--;
      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', content, citedChunkIds: [], createdAt: new Date().toISOString() },
      ]);
      try {
        const data = await api.post(`/agent/conversations/${conversationId}/messages`, { content });
        setMessages((prev) => [...prev, { ...data.message, citations: [] }]);
        if (data.pendingActions?.length) setActions((prev) => [...prev, ...data.pendingActions]);
        setBusy(null);
        return true;
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== userId));
        if (err?.data?.code === 'assistant_busy') {
          setBusy(err.message || BUSY_TEXT);
        } else {
          setError(err?.message || 'The assistant is temporarily unavailable. Please try again shortly.');
        }
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationId, setMessages]
  );

  const resolveAction = useCallback(
    async (actionId, decision) => {
      setError(null);
      setActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, busy: true } : a)));
      try {
        const data = await api.post(`/agent/actions/${actionId}/${decision}`);
        appendAssistantMessage(data.action.resultMessage || (decision === 'confirm' ? 'Done.' : 'Okay, not going ahead.'));
        setActions((prev) => prev.filter((a) => a.id !== actionId));
      } catch (err) {
        // The slot may have been taken, or the request may have expired: tell
        // the patient plainly and drop the card — the assistant can try again.
        appendAssistantMessage(`That change could not be made: ${err?.message || 'please try again'}. Tell me another time and I'll look again.`);
        setActions((prev) => prev.filter((a) => a.id !== actionId));
      }
    },
    [appendAssistantMessage]
  );

  return { enabled, bookingMode, setBookingMode, actions, sending, error, busy, sendBookingMessage, resolveAction };
}
